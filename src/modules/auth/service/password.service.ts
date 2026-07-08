import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomInt } from 'crypto';
import { hash, compare } from 'bcrypt';
import { AuthRepository } from '../repository/auth.repository';
import { EmailService } from '../../email/email.service';
import { TokenService } from './token.service';
import { RedisService } from '../../../core/redis/redis.service';
import { ChangePasswordDto, RequestOtpDto, VerifyOtpDto, ResetPasswordDto } from '../dto/auth.dto';

/**
 * PasswordService
 *
 * Handles all password-related operations:
 * - Password hashing and validation (bcrypt)
 * - Authenticated password change
 * - OTP-based password reset (OTP stored in Redis — not the DB)
 *
 * OTP security:
 *  - Generated with crypto.randomInt (CSPRNG, not Math.random)
 *  - Stored as SHA-256 hash in Redis with a 10-minute TTL
 *  - Deleted immediately after successful use (no replay)
 *  - DB never sees the OTP value
 */
@Injectable()
export class PasswordService {
  private readonly logger       = new Logger(PasswordService.name);
  private readonly SALT_ROUNDS    = 10;
  private readonly OTP_TTL_SECONDS = 600; // 10 minutes

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly emailService:   EmailService,
    private readonly tokenService:   TokenService,
    private readonly redisService:   RedisService,
  ) {}

  // ─── Hashing ──────────────────────────────────────────────────────────────

  async hashPassword(password: string): Promise<string> {
    return hash(password, this.SALT_ROUNDS);
  }

  async comparePasswords(plain: string, hashed: string): Promise<boolean> {
    return compare(plain, hashed);
  }

  // ─── Change Password (authenticated) ─────────────────────────────────────

  /**
   * Change password for an authenticated user.
   *
   * @throws NotFoundException      if user does not exist
   * @throws UnauthorizedException  if current password is wrong
   */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ message: string }> {
    const user = await this.authRepository.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const valid = await this.comparePasswords(dto.currentPassword, user.password);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    await this.authRepository.updatePassword(userId, await this.hashPassword(dto.newPassword));

    try {
      await this.emailService.sendPasswordChangedEmail(user.email);
    } catch (err) {
      this.logger.error(`Failed to send password-changed email to ${user.email}`, err);
      // Non-fatal — password was changed successfully
    }

    return { message: 'Password changed successfully' };
  }

  // ─── OTP Reset Flow ───────────────────────────────────────────────────────

  /**
   * Step 1 — Request OTP
   *
   * - Verifies the email exists (returns 404 rather than leaking nothing,
   *   since the client explicitly provided the email to look up)
   * - Generates a CSPRNG 6-digit OTP
   * - Stores a SHA-256 hash of it in Redis with a 10-minute TTL
   * - Sends the plain OTP to the user's email
   * - Returns a short-lived resetToken cookie payload (otpVerified: false)
   *
   * @throws NotFoundException if the email does not exist
   */
  async requestPasswordReset(dto: RequestOtpDto): Promise<{ resetToken: string }> {
    const user = await this.authRepository.findByEmail(dto.email);
    if (!user) throw new NotFoundException('Email not found');

    // Cryptographically secure 6-digit OTP
    const otp = randomInt(100_000, 1_000_000).toString();

    // Store hashed OTP in Redis — auto-expires after TTL
    await this.redisService.setOtp(user.id, otp, this.OTP_TTL_SECONDS);

    // Send plain OTP to user — log error but don't crash the request
    try {
      await this.emailService.sendOtpEmail(user.email, otp);
    } catch (err) {
      this.logger.error(`Failed to send OTP email to ${user.email}`, err);
      throw new BadRequestException('Failed to send OTP email. Check SMTP configuration.');
    }

    const resetToken = this.tokenService.generateResetToken(user.id, user.email, false);
    return { resetToken };
  }

  /**
   * Step 2 — Verify OTP
   *
   * Reads userId from the resetToken (cookie), verifies the submitted OTP
   * against the hash in Redis. If valid, re-issues the reset token with
   * otpVerified = true (the OTP is NOT deleted yet — deleted on actual reset).
   *
   * @throws BadRequestException if OTP is wrong or expired
   */
  async verifyOtp(userId: string, otp: string): Promise<{ resetToken: string }> {
    const user = await this.authRepository.findById(userId);
    if (!user) throw new BadRequestException('Invalid or expired OTP');

    const valid = await this.redisService.verifyOtp(userId, otp);
    if (!valid) throw new BadRequestException('Invalid or expired OTP');

    // Re-issue token with otpVerified = true — OTP stays in Redis until reset
    const resetToken = this.tokenService.generateResetToken(user.id, user.email, true);
    return { resetToken };
  }

  /**
   * Step 3 — Reset Password
   *
   * The resetToken cookie must have otpVerified = true (enforced in the
   * controller before calling here). Confirms the OTP still exists in Redis
   * (guards against expiry between verify and reset), then updates the password
   * and deletes the OTP.
   *
   * @throws BadRequestException if OTP has expired or was already used
   */
  async resetPassword(userId: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.authRepository.findById(userId);
    if (!user) throw new BadRequestException('Invalid reset session');

    // Confirm OTP is still present in Redis (guards against expiry after verify)
    const otpStillValid = await this.redisService.otpExists(userId);
    if (!otpStillValid) throw new BadRequestException('OTP session expired — request a new OTP');

    await this.authRepository.updatePassword(userId, await this.hashPassword(newPassword));

    // Delete OTP after use to prevent replay
    await this.redisService.deleteOtp(userId);

    try {
      await this.emailService.sendPasswordChangedEmail(user.email);
    } catch (err) {
      this.logger.error(`Failed to send password-changed email to ${user.email}`, err);
      // Non-fatal — password was reset successfully
    }

    return { message: 'Password reset successfully' };
  }
}
