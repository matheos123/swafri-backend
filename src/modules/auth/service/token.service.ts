import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';

/**
 * TokenPayload
 *
 * Shape of the decoded JWT payload used throughout the app.
 * jti (JWT ID) is included so individual tokens can be blacklisted
 * without affecting other tokens for the same user.
 */
export interface TokenPayload {
  sub: string;    // user ID
  email: string;
  jti: string;    // unique token ID — used for blacklisting
  iat?: number;   // issued-at  (set automatically by JwtService)
  exp?: number;   // expires-at (set automatically by JwtService)
}

/**
 * ResetTokenPayload
 *
 * Shape of the short-lived password reset token.
 * Issued after a successful OTP request; consumed on password reset.
 *
 * - purpose: narrows the token so it cannot be used as an access token
 * - otpVerified: flipped to true after the user verifies their OTP,
 *   which is required before /reset-password will accept the token
 */
export interface ResetTokenPayload {
  sub: string;              // user ID
  email: string;
  jti: string;
  purpose: 'password-reset';
  otpVerified: boolean;     // true once /verify-otp succeeds
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
 *
 * Separation of Concerns:
 * - Knows nothing about users, passwords, or HTTP
 * - Purely responsible for JWT creation and validation
 */
@Injectable()
export class TokenService {
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;
  private readonly jwtRefreshExpiresIn: string;

  // Reset tokens are short-lived — same duration as an OTP (10 min)
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
   * Each token gets its own unique JTI so they can be individually
   * revoked without affecting the other.
   *
   * @param userId - User's unique identifier
   * @param email  - User's email address
   */
  generateTokenPair(userId: string, email: string): { accessToken: string; refreshToken: string } {
    const basePayload = { sub: userId, email };

    const accessToken = this.jwtService.sign(
      { ...basePayload, jti: uuidv4() }, // unique ID per token
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
   * Issued after a successful OTP request so the user does not need
   * to re-submit their email on subsequent steps.
   *
   * Set otpVerified = false initially; the token is re-issued with
   * otpVerified = true after the user proves they have the OTP.
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

    // Signed with the same secret as access tokens but scoped by `purpose`
    return this.jwtService.sign(payload, {
      expiresIn: this.RESET_TOKEN_EXPIRES_IN,
    });
  }

  // ─── Token Verification ───────────────────────────────────────────────────

  /**
   * Verify and decode an access token.
   *
   * @param token           - JWT access token
   * @param ignoreExpiration - When true, expired tokens are still decoded
   *                          (used by the guard to read the payload before
   *                           attempting a silent refresh)
   * @returns Decoded payload or null if the signature is invalid
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
   * @returns Decoded payload or null if invalid / expired
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

      // Reject tokens that are not explicitly scoped to password-reset
      if (payload.purpose !== 'password-reset') return null;

      return payload;
    } catch {
      return null;
    }
  }
}
