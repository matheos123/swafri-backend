import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { hash, compare } from 'bcrypt';
import { AuthRepository } from '../repository/auth.repository';
import { EmailService } from '../../email/email.service';
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
   * Generate and send OTP for password reset
   * 
   * Security considerations:
   * - Doesn't reveal if email exists (prevents user enumeration)
   * - OTP is 6 digits for user convenience
   * - OTP expires after configured time period
   * - OTP is stored hashed in database
   * 
   * @param dto - Contains user's email
   * @returns Generic success message (doesn't reveal if email exists)
   */
  async requestPasswordReset(dto: RequestOtpDto): Promise<{ message: string }> {
    const user = await this.authRepository.findByEmail(dto.email);

    // Generic message to prevent user enumeration attack
    const genericMessage = 'If the email exists, an OTP has been sent';

    if (!user) {
      return { message: genericMessage };
    }

    // Generate 6-digit OTP
    const otp = this.generateOtp();
    const otpExpiry = this.calculateOtpExpiry();

    // Store OTP and expiry in database
    await this.authRepository.setOtp(user.id, otp, otpExpiry);

    // Send OTP via email
    await this.emailService.sendOtpEmail(user.email, otp);

    return { message: genericMessage };
  }

  /**
   * Verify OTP without resetting password
   * 
   * Allows frontend to validate OTP before showing password reset form
   * 
   * @param dto - Contains email and OTP to verify
   * @returns Verification status
   * @throws BadRequestException if OTP is invalid or expired
   */
  async verifyOtp(dto: VerifyOtpDto): Promise<{ message: string; verified: boolean }> {
    const user = await this.authRepository.findByEmail(dto.email);

    // Validate OTP exists and hasn't expired
    if (!user || !user.otp || !user.otpExpiry) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Verify OTP matches
    if (user.otp !== dto.otp) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Check OTP hasn't expired
    if (new Date() > user.otpExpiry) {
      await this.authRepository.clearOtp(user.id);
      throw new BadRequestException('Invalid or expired OTP');
    }

    return { message: 'OTP verified successfully', verified: true };
  }

  /**
   * Reset password using verified OTP
   * 
   * Flow:
   * 1. Verify OTP is valid
   * 2. Hash new password
   * 3. Update password
   * 4. Clear OTP from database
   * 5. Send confirmation email
   * 
   * @param dto - Contains email, OTP, and new password
   * @returns Success message
   * @throws BadRequestException if OTP is invalid or expired
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const user = await this.authRepository.findByEmail(dto.email);

    // Validate OTP exists and user exists
    if (!user || !user.otp || !user.otpExpiry) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Verify OTP matches
    if (user.otp !== dto.otp) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Check OTP hasn't expired
    if (new Date() > user.otpExpiry) {
      await this.authRepository.clearOtp(user.id);
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Hash new password and update
    const hashedPassword = await this.hashPassword(dto.newPassword);
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
