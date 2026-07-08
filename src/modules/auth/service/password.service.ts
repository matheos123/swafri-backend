import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { hash, compare } from 'bcrypt';
import { AuthRepository } from '../repository/auth.repository';
import { EmailService } from '../../email/email.service';
import { TokenService } from './token.service';
import {
  ChangePasswordDto,
  RequestOtpDto,
  VerifyOtpDto,
  ResetPasswordDto,
} from '../dto/auth.dto';

/**
 * PasswordService
 * 
 * Manages all password-related operations including:
 * - Password hashing and validation
 * - Password change functionality
 * - OTP-based password reset flow
 * 
 * Separation of Concerns:
 * - Isolated from authentication logic (login/register)
 * - Handles password operations independently
 * - Manages OTP lifecycle (generation, validation, expiration)
 */
@Injectable()
export class PasswordService {
  // OTP validity period in minutes
  private readonly OTP_EXPIRY_MINUTES = 10;
  // Number of bcrypt salt rounds for password hashing
  private readonly SALT_ROUNDS = 10;

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly emailService: EmailService,
    private readonly tokenService: TokenService,
  ) {}

  // ─── Password Hashing & Validation ───────────────────────────────────────

  /**
   * Hash a plain text password using bcrypt
   * 
   * @param password - Plain text password to hash
   * @returns Hashed password
   */
  async hashPassword(password: string): Promise<string> {
    return hash(password, this.SALT_ROUNDS);
  }

  /**
   * Compare a plain text password with a hashed password
   * 
   * @param plainPassword - Plain text password to compare
   * @param hashedPassword - Hashed password from database
   * @returns True if passwords match, false otherwise
   */
  async comparePasswords(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return compare(plainPassword, hashedPassword);
  }

  // ─── Change Password (Authenticated Users) ───────────────────────────────

  /**
   * Change password for an authenticated user
   * 
   * Flow:
   * 1. Verify user exists
   * 2. Validate current password
   * 3. Hash new password
   * 4. Update password in database
   * 5. Send confirmation email
   * 
   * @param userId - User's unique identifier
   * @param dto - Contains current and new password
   * @returns Success message
   * @throws NotFoundException if user doesn't exist
   * @throws UnauthorizedException if current password is incorrect
   */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ message: string }> {
    // Verify user exists
    const user = await this.authRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate current password
    const isValidPassword = await this.comparePasswords(dto.currentPassword, user.password);
    if (!isValidPassword) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash and update new password
    const hashedPassword = await this.hashPassword(dto.newPassword);
    await this.authRepository.updatePassword(userId, hashedPassword);

    // Notify user via email
    await this.emailService.sendPasswordChangedEmail(user.email);

    return { message: 'Password changed successfully' };
  }

  // ─── OTP-Based Password Reset Flow ───────────────────────────────────────

  /**
   * Generate and send OTP for password reset, return a reset token
   *
   * Flow:
   * 1. Check if the email exists (prevents enumeration with a generic message)
   * 2. Generate a 6-digit OTP and store it with expiry
   * 3. Send OTP via email
   * 4. Return a short-lived reset token (JWT, 10 min) that carries userId + email
   *
   * @param dto - Contains user's email
   * @returns reset token (JWT) to be set as a cookie by the controller
   * @throws NotFoundException if the email doesn't exist
   */
  async requestPasswordReset(dto: RequestOtpDto): Promise<{ resetToken: string }> {
    const user = await this.authRepository.findByEmail(dto.email);

    if (!user) {
      throw new NotFoundException('Email not found');
    }

    // Generate 6-digit OTP
    const otp = this.generateOtp();
    const otpExpiry = this.calculateOtpExpiry();

    // Store OTP and expiry in database
    await this.authRepository.setOtp(user.id, otp, otpExpiry);

    // Send OTP via email
    await this.emailService.sendOtpEmail(user.email, otp);

    // Issue a reset token (10 min) — otpVerified=false until user proves OTP
    const resetToken = this.tokenService.generateResetToken(user.id, user.email, false);
    return { resetToken };
  }

  /**
   * Verify the OTP without resetting the password
   *
   * The reset token (from cookie) provides userId + email, so the client
   * only needs to send the OTP itself.
   *
   * If valid, returns a new reset token with `otpVerified: true`.
   *
   * @param userId - Extracted from reset token cookie
   * @param otp    - The 6-digit code the user received via email
   * @returns New reset token with otpVerified=true to be set as a cookie
   * @throws BadRequestException if the OTP is invalid or expired
   */
  async verifyOtp(userId: string, otp: string): Promise<{ resetToken: string }> {
    const user = await this.authRepository.findById(userId);

    // Validate OTP exists and hasn't expired
    if (!user || !user.otp || !user.otpExpiry) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Verify OTP matches
    if (user.otp !== otp) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Check OTP hasn't expired
    if (new Date() > user.otpExpiry) {
      await this.authRepository.clearOtp(user.id);
      throw new BadRequestException('Invalid or expired OTP');
    }

    // OTP is valid — re-issue reset token with otpVerified = true
    const resetToken = this.tokenService.generateResetToken(user.id, user.email, true);
    return { resetToken };
  }

  /**
   * Reset the password using a verified reset token
   *
   * The reset token must have `otpVerified: true` or this will fail.
   * The client only needs to send the new password; userId + OTP state
   * are carried in the reset token cookie.
   *
   * @param userId      - Extracted from reset token
   * @param newPassword - New password to set
   * @returns Success message
   * @throws BadRequestException if OTP verification is missing or OTP expired
   */
  async resetPassword(userId: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.authRepository.findById(userId);

    // Final check: OTP must still be present and valid (hasn't been cleared or expired)
    if (!user || !user.otp || !user.otpExpiry) {
      throw new BadRequestException('OTP session expired');
    }

    if (new Date() > user.otpExpiry) {
      await this.authRepository.clearOtp(user.id);
      throw new BadRequestException('OTP session expired');
    }

    // Hash new password and update
    const hashedPassword = await this.hashPassword(newPassword);
    await this.authRepository.updatePassword(user.id, hashedPassword);

    // Clear OTP after successful reset
    await this.authRepository.clearOtp(user.id);

    // Notify user via email
    await this.emailService.sendPasswordChangedEmail(user.email);

    return { message: 'Password reset successfully' };
  }

  // ─── Private Helper Methods ──────────────────────────────────────────────

  /**
   * Generate a random 6-digit OTP
   * 
   * @returns 6-digit OTP as string
   */
  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Calculate OTP expiry timestamp
   * 
   * @returns Date object representing when OTP expires
   */
  private calculateOtpExpiry(): Date {
    return new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);
  }
}
