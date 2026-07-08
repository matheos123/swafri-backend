import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthRepository } from '../repository/auth.repository';
import { UserService } from '../../user/service/user.service';
import { TokenService } from './token.service';
import { PasswordService } from './password.service';
import { RedisService } from '../../../core/redis/redis.service';
import {
  LoginDto,
  RegisterDto,
  AuthResponseDto,
  ChangePasswordDto,
  RequestOtpDto,
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
    private readonly redisService: RedisService,
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
  async register(dto: RegisterDto): Promise<AuthResponseDto & { accessToken: string; refreshToken: string }> {
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

      // Generate JWT tokens (role embedded so guards skip DB lookup)
      const tokens = this.tokenService.generateTokenPair(user.id, user.email, user.role);

      // Store hashed refresh token for security
      const hashedRefreshToken = await this.passwordService.hashPassword(tokens.refreshToken);
      await this.authRepository.setRefreshTokenHash(user.id, hashedRefreshToken);

      // Return user data without sensitive fields (tokens only used internally by controller for cookies)
      return {
        user: this.stripSensitiveFields(user),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
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
  async login(dto: LoginDto): Promise<AuthResponseDto & { accessToken: string; refreshToken: string }> {
    // Find user by email
    const user = await this.userService.findByEmail(dto.email);

    // Validate user exists and password matches
    if (!user || !(await this.passwordService.comparePasswords(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reject login for deactivated accounts (403 not 401 — credentials are valid)
    if (!user.isActive) {
      throw new ForbiddenException('Account is deactivated');
    }

    // Generate JWT tokens (role embedded)
    const tokens = this.tokenService.generateTokenPair(user.id, user.email, user.role);

    // Store hashed refresh token
    const hashedRefreshToken = await this.passwordService.hashPassword(tokens.refreshToken);
    await this.authRepository.setRefreshTokenHash(user.id, hashedRefreshToken);

    // Return user data without sensitive fields (tokens only used internally by controller for cookies)
    return {
      user: this.stripSensitiveFields(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  // ─── Logout ──────────────────────────────────────────────────────────────

  /**
   * Revoke user's refresh token and blacklist both access + refresh tokens
   *
   * This ensures:
   * - The refresh token in the DB is cleared
   * - Both tokens are added to the Redis blacklist so they can't be reused
   *   even if the attacker somehow extracted them before they expired
   *
   * @param userId - User's unique identifier
   * @param accessToken - Current access token (to blacklist)
   * @param refreshToken - Current refresh token (to blacklist)
   * @returns Success message
   */
  async logout(
    userId: string,
    accessToken?: string,
    refreshToken?: string,
  ): Promise<{ message: string }> {
    // Clear refresh token from database
    await this.authRepository.removeRefreshToken(userId);

    // Blacklist access token if provided
    if (accessToken) {
      const payload = this.tokenService.verifyAccessToken(accessToken, true);
      if (payload?.jti && payload.exp) {
        const ttlMs = (payload.exp - Math.floor(Date.now() / 1000)) * 1000;
        await this.redisService.blacklist(payload.jti, ttlMs);
      }
    }

    // Blacklist refresh token if provided
    if (refreshToken) {
      const payload = this.tokenService.verifyRefreshToken(refreshToken);
      if (payload?.jti && payload.exp) {
        const ttlMs = (payload.exp - Math.floor(Date.now() / 1000)) * 1000;
        await this.redisService.blacklist(payload.jti, ttlMs);
      }
    }

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
   * Request OTP — sends email, returns a reset token to be set as cookie
   */
  async requestPasswordReset(dto: RequestOtpDto): Promise<{ resetToken: string }> {
    return this.passwordService.requestPasswordReset(dto);
  }

  /**
   * Verify OTP — userId read from reset token cookie
   * Returns a new reset token with otpVerified=true
   */
  async verifyOtp(userId: string, otp: string): Promise<{ resetToken: string }> {
    return this.passwordService.verifyOtp(userId, otp);
  }

  /**
   * Reset password — userId read from verified reset token cookie
   */
  async resetPassword(userId: string, newPassword: string): Promise<{ message: string }> {
    return this.passwordService.resetPassword(userId, newPassword);
  }
}
