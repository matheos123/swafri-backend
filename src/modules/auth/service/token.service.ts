import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

/**
 * TokenService
 * 
 * Handles all JWT token-related operations including:
 * - Token generation (access and refresh tokens)
 * - Token validation and verification
 * 
 * Separation of Concerns:
 * - Isolated from business logic (user registration, login)
 * - Focused solely on token operations
 * - Encapsulates JWT configuration and secret management
 */
@Injectable()
export class TokenService {
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly jwtRefreshExpiresIn: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {
    // Load JWT configuration from environment
    this.jwtSecret = this.config.get<string>('jwt.secret')!;
    this.jwtRefreshSecret = this.config.get<string>('jwt.refreshSecret')!;
    this.jwtExpiresIn = this.config.get<string>('jwt.expiresIn') ?? '15m';
    this.jwtRefreshExpiresIn = this.config.get<string>('jwt.refreshExpiresIn') ?? '7d';
  }

  // ─── Token Generation ────────────────────────────────────────────────────

  /**
   * Generate both access and refresh tokens for a user
   * 
   * @param userId - User's unique identifier
   * @param email - User's email address
   * @returns Object containing accessToken and refreshToken
   */
  generateTokenPair(userId: string, email: string): { accessToken: string; refreshToken: string } {
    const payload = { sub: userId, email };

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, {
        secret: this.jwtRefreshSecret,
        expiresIn: this.jwtRefreshExpiresIn as any,
      }),
    };
  }

  // ─── Token Verification ──────────────────────────────────────────────────

  /**
   * Verify and decode a refresh token
   * 
   * @param token - JWT refresh token to verify
   * @returns Decoded token payload containing userId and email
   * @throws Error if token is invalid or expired
   */
  verifyRefreshToken(token: string): { sub: string; email: string } {
    return this.jwtService.verify(token, { secret: this.jwtRefreshSecret });
  }
}
