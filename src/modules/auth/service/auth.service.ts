import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthRepository } from '../repository/auth.repository';
import { UserService } from '../../user/service/user.service';
import { TokenService } from './token.service';
import { PasswordService } from './password.service';
import {
  LoginDto,
  RegisterDto,
  AuthResponseDto,
  ChangePasswordDto,
  RequestOtpDto,
  VerifyOtpDto,
  ResetPasswordDto,
} from '../dto/auth.dto';

/**
 * AuthService
 * 
 * Main authentication service orchestrating:
 * - User registration and login flows
 * - Token refresh and logout operations
 * - User profile retrieval
 * 
 * Separation of Concerns:
 * - Delegates token operations to TokenService
 * - Delegates password operations to PasswordService
 * - Focuses on authentication flow orchestration
 * - Uses AuthRepository for data access
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly userService: UserService,
    private readonly tokenService: TokenService,
    private readonly passwordService: PasswordService,
  ) {}

  // ─── Helper Methods ──────────────────────────────────────────────────────

  /**
   * Strip sensitive fields from user object
   * 
   * Removes password and refresh token before sending to client
   * 
   * @param user - User object from database
   * @returns User object without sensitive fields
   */
  private stripSensitiveFields(user: any): Record<string, unknown> {
    const { password, refreshToken, otp, otpExpiry, ...rest } = user;
    return rest;
  }

  // ─── Registration ────────────────────────────────────────────────────────

  /**
   * Register a new user
   * 
   * Flow:
   * 1. Check if email or username already exists
   * 2. Hash password
   * 3. Create user in database
   * 4. Generate access and refresh tokens
   * 5. Store hashed refresh token
   * 6. Return user data and tokens
   * 
   * @param dto - User registration data
   * @returns User object with access and refresh tokens
   * @throws ConflictException if email or username already exists
   */
  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    // Check if email already exists
    if (await this.userService.findByEmail(dto.email)) {
      throw new ConflictException('Email already in use');
    }

    // Check if username already exists
    if (await this.userService.findByUsername(dto.username)) {
      throw new ConflictException('Username already in use');
    }

    try {
      // Hash password before storing
      const hashedPassword = await this.passwordService.hashPassword(dto.password);

      // Create user in database
      const user = await this.userService.create({
        email: dto.email,
        username: dto.username,
        password: hashedPassword,
      });

      // Generate JWT tokens
      const tokens = this.tokenService.generateTokenPair(user.id, user.email);

      // Store hashed refresh token for security
      const hashedRefreshToken = await this.passwordService.hashPassword(tokens.refreshToken);
      await this.authRepository.setRefreshTokenHash(user.id, hashedRefreshToken);

      // Return user data without sensitive fields
      return {
        user: this.stripSensitiveFields(user),
        ...tokens,
      };
    } catch (err) {
      // Handle unique constraint violations from Prisma
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Duplicate field value entered');
      }
      throw err;
    }
  }

  // ─── Login ───────────────────────────────────────────────────────────────

  /**
   * Authenticate user and generate tokens
   * 
   * Flow:
   * 1. Find user by email
   * 2. Validate password
   * 3. Generate new access and refresh tokens
   * 4. Store hashed refresh token
   * 5. Return user data and tokens
   * 
   * @param dto - User login credentials
   * @returns User object with access and refresh tokens
   * @throws UnauthorizedException if credentials are invalid
   */
  async login(dto: LoginDto): Promise<AuthResponseDto> {
    // Find user by email
    const user = await this.userService.findByEmail(dto.email);

    // Validate user exists and password matches
    if (!user || !(await this.passwordService.comparePasswords(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT tokens
    const tokens = this.tokenService.generateTokenPair(user.id, user.email);

    // Store hashed refresh token
    const hashedRefreshToken = await this.passwordService.hashPassword(tokens.refreshToken);
    await this.authRepository.setRefreshTokenHash(user.id, hashedRefreshToken);

    // Return user data without sensitive fields
    return {
      user: this.stripSensitiveFields(user),
      ...tokens,
    };
  }

  // ─── Refresh Token ───────────────────────────────────────────────────────

  /**
   * Generate new access and refresh tokens using valid refresh token
   * 
   * Flow:
   * 1. Verify refresh token signature and expiry
   * 2. Find user from token payload
   * 3. Validate refresh token matches stored hash
   * 4. Generate new token pair
   * 5. Update stored refresh token hash
   * 6. Return new tokens
   * 
   * @param token - Current refresh token
   * @returns User object with new access and refresh tokens
   * @throws UnauthorizedException if token is invalid or revoked
   */
  async refresh(token: string): Promise<AuthResponseDto> {
    let payload: { sub: string; email: string };

    try {
      // Verify token signature and expiry
      payload = this.tokenService.verifyRefreshToken(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Find user from token payload
    const user = await this.authRepository.findById(payload.sub);
    if (!user?.refreshToken) {
      throw new UnauthorizedException('Refresh token revoked');
    }

    // Validate refresh token matches stored hash
    const isValid = await this.passwordService.comparePasswords(token, user.refreshToken);
    if (!isValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Generate new token pair
    const tokens = this.tokenService.generateTokenPair(user.id, user.email);

    // Update stored refresh token hash
    const hashedRefreshToken = await this.passwordService.hashPassword(tokens.refreshToken);
    await this.authRepository.setRefreshTokenHash(user.id, hashedRefreshToken);

    // Return user data without sensitive fields
    return {
      user: this.stripSensitiveFields(user),
      ...tokens,
    };
  }

  // ─── Logout ──────────────────────────────────────────────────────────────

  /**
   * Revoke user's refresh token
   * 
   * Removes stored refresh token, invalidating future refresh attempts
   * Note: Access token remains valid until expiry
   * 
   * @param userId - User's unique identifier
   * @returns Success message
   */
  async logout(userId: string): Promise<{ message: string }> {
    await this.authRepository.removeRefreshToken(userId);
    return { message: 'Logged out successfully' };
  }

  // ─── Profile ─────────────────────────────────────────────────────────────

  /**
   * Retrieve authenticated user's profile
   * 
   * @param userId - User's unique identifier
   * @returns User profile data
   */
  async getProfile(userId: string) {
    return this.userService.findById(userId);
  }

  // ─── Password Operations (Delegated) ─────────────────────────────────────

  /**
   * Change password for authenticated user
   * Delegates to PasswordService
   */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ message: string }> {
    return this.passwordService.changePassword(userId, dto);
  }

  /**
   * Request password reset OTP
   * Delegates to PasswordService
   */
  async requestPasswordReset(dto: RequestOtpDto): Promise<{ message: string }> {
    return this.passwordService.requestPasswordReset(dto);
  }

  /**
   * Verify OTP for password reset
   * Delegates to PasswordService
   */
  async verifyOtp(dto: VerifyOtpDto): Promise<{ message: string; verified: boolean }> {
    return this.passwordService.verifyOtp(dto);
  }

  /**
   * Reset password using OTP
   * Delegates to PasswordService
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    return this.passwordService.resetPassword(dto);
  }
}
