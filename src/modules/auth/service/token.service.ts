import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

/**
 * TokenPayload
 *
 * Shape of the decoded JWT payload used throughout the app.
 * - jti: unique ID per token, used for blacklisting
 * - role: embedded so guards can authorise without a DB lookup
 */
export interface TokenPayload {
  sub: string;
  email: string;
  role: Role;
  jti: string;
  iat?: number;
  exp?: number;
}

/**
 * ResetTokenPayload
 *
 * Short-lived token issued after a successful OTP request.
 * - purpose: narrows the token so it cannot be used as an access token
 * - otpVerified: flipped to true after /verify-otp succeeds
 */
export interface ResetTokenPayload {
  sub: string;
  email: string;
  jti: string;
  purpose: 'password-reset';
  otpVerified: boolean;
  iat?: number;
  exp?: number;
}

/**
 * TokenService
 *
 * Handles all JWT token-related operations:
 * - Generating access + refresh token pairs (each with a unique JTI)
 * - Generating short-lived password-reset tokens
 * - Verifying tokens (with or without expiry enforcement)
 */
@Injectable()
export class TokenService {
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly jwtRefreshExpiresIn: string;
  private readonly RESET_TOKEN_EXPIRES_IN = '10m';

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {
    this.jwtSecret = this.config.get<string>('jwt.secret')!;
    this.jwtRefreshSecret = this.config.get<string>('jwt.refreshSecret')!;
    this.jwtRefreshExpiresIn = this.config.get<string>('jwt.refreshExpiresIn') ?? '7d';
  }

  // ─── Token Generation ─────────────────────────────────────────────────────

  /**
   * Generate a fresh access + refresh token pair.
   *
   * Role is embedded in the payload so downstream guards can authorise
   * requests without an extra DB round-trip on every request.
   *
   * @param userId - User's unique identifier
   * @param email  - User's email address
   * @param role   - User's current role (USER | ADMIN)
   */
  generateTokenPair(
    userId: string,
    email: string,
    role: Role,
  ): { accessToken: string; refreshToken: string } {
    const basePayload = { sub: userId, email, role };

    const accessToken = this.jwtService.sign(
      { ...basePayload, jti: uuidv4() },
    );

    const refreshToken = this.jwtService.sign(
      { ...basePayload, jti: uuidv4() },
      {
        secret: this.jwtRefreshSecret,
        expiresIn: this.jwtRefreshExpiresIn as any,
      },
    );

    return { accessToken, refreshToken };
  }

  /**
   * Generate a short-lived password-reset token.
   *
   * @param userId      - User's unique identifier
   * @param email       - User's email address
   * @param otpVerified - Whether the OTP has been confirmed
   */
  generateResetToken(userId: string, email: string, otpVerified = false): string {
    const payload: Omit<ResetTokenPayload, 'iat' | 'exp'> = {
      sub: userId,
      email,
      jti: uuidv4(),
      purpose: 'password-reset',
      otpVerified,
    };

    return this.jwtService.sign(payload, {
      expiresIn: this.RESET_TOKEN_EXPIRES_IN,
    });
  }

  // ─── Token Verification ───────────────────────────────────────────────────

  /**
   * Verify and decode an access token.
   *
   * @param token            - JWT access token
   * @param ignoreExpiration - When true, expired tokens are still decoded
   */
  verifyAccessToken(token: string, ignoreExpiration = false): TokenPayload | null {
    try {
      return this.jwtService.verify<TokenPayload>(token, {
        secret: this.jwtSecret,
        ignoreExpiration,
      });
    } catch {
      return null;
    }
  }

  /**
   * Verify and decode a refresh token.
   *
   * @param token - JWT refresh token
   */
  verifyRefreshToken(token: string): TokenPayload | null {
    try {
      return this.jwtService.verify<TokenPayload>(token, {
        secret: this.jwtRefreshSecret,
      });
    } catch {
      return null;
    }
  }

  /**
   * Verify and decode a password-reset token.
   *
   * Returns null if the token is invalid, expired, or not purpose-scoped.
   *
   * @param token - JWT password-reset token
   */
  verifyResetToken(token: string): ResetTokenPayload | null {
    try {
      const payload = this.jwtService.verify<ResetTokenPayload>(token, {
        secret: this.jwtSecret,
      });

      if (payload.purpose !== 'password-reset') return null;

      return payload;
    } catch {
      return null;
    }
  }
}
