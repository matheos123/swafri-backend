import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches } from 'class-validator';

// ─── Shared Validation Constants ─────────────────────────────────────────────

/** Password must contain at least one letter and one number */
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).+$/;
const PASSWORD_REGEX_MSG = 'password must contain letters and numbers';

// ─── Authentication DTOs ──────────────────────────────────────────────────────

export class RegisterDto {
  @ApiProperty({ example: 'player@arena.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'player1' })
  @IsString()
  @Length(3, 20)
  username!: string;

  @ApiProperty({ example: 'P@ssw0rd!' })
  @IsString()
  @Length(8, 128)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_REGEX_MSG })
  password!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'player@arena.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'P@ssw0rd!' })
  @IsString()
  @Length(8, 128)
  password!: string;
}

// ─── Response DTOs ────────────────────────────────────────────────────────────

export class AuthResponseDto {
  @ApiProperty({ type: () => Object, description: 'User profile without sensitive fields' })
  user!: Record<string, unknown>;

  @ApiProperty({ description: 'Short-lived access token (15 min)' })
  accessToken!: string;

  @ApiProperty({ description: 'Long-lived refresh token (7 days)' })
  refreshToken!: string;
}

// ─── Password Management DTOs ─────────────────────────────────────────────────

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldP@ssw0rd!' })
  @IsString()
  @Length(8, 128)
  currentPassword!: string;

  @ApiProperty({ example: 'NewP@ssw0rd!' })
  @IsString()
  @Length(8, 128)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_REGEX_MSG })
  newPassword!: string;
}

// ─── OTP / Password Reset DTOs ────────────────────────────────────────────────

export class RequestOtpDto {
  @ApiProperty({ example: 'player@arena.com', description: 'Email to send the OTP to' })
  @IsEmail()
  email!: string;
}

/** Sent to POST /auth/verify-otp — email is read from the resetToken cookie */
export class VerifyOtpDto {
  @ApiProperty({ example: '123456', description: '6-digit OTP sent to email' })
  @IsString()
  @Length(6, 6)
  otp!: string;
}

/** Sent to POST /auth/reset-password — identity proven via resetToken cookie */
export class ResetPasswordDto {
  @ApiProperty({ example: 'NewP@ssw0rd!' })
  @IsString()
  @Length(8, 128)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_REGEX_MSG })
  newPassword!: string;
}
