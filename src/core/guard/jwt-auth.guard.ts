import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { TokenService, TokenPayload } from '../../modules/auth/service/token.service';
import { AuthRepository } from '../../modules/auth/repository/auth.repository';
import { PasswordService } from '../../modules/auth/service/password.service';
import { RedisService } from '../redis/redis.service';

/**
 * JwtAuthGuard
 *
 * Replaces the thin Passport wrapper with a fully self-contained guard that:
 *
 *  1. Extracts the accessToken from the HTTP-only cookie
 *  2. Checks the token JTI against the Redis blacklist (revoked tokens)
 *  3a. If the access token is valid → attaches user to request and proceeds
 *  3b. If the access token is EXPIRED → attempts a silent refresh:
 *        - Reads refreshToken from cookie
 *        - Checks refresh token JTI against blacklist
 *        - Validates refresh token signature
 *        - Compares against stored hash in DB
 *        - Issues a new token pair and sets fresh cookies
 *        - Attaches user to request and proceeds
 *  4. Any other failure → 401 Unauthorized
 *
 * This means the frontend never needs to call /auth/refresh explicitly —
 * it just retries any 401 and the guard handles the rotation transparently.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  // Cookie max-ages mirror the JWT expiry values
  private readonly ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000;        // 15 minutes
  private readonly REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor(
    private readonly tokenService: TokenService,
    private readonly authRepository: AuthRepository,
    private readonly passwordService: PasswordService,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const accessToken: string | undefined = req.cookies?.accessToken;
    const refreshToken: string | undefined = req.cookies?.refreshToken;

    // ── No access token at all ────────────────────────────────────────────
    if (!accessToken) {
      throw new UnauthorizedException('No access token provided');
    }

    // ── Decode without enforcing expiry so we can read the JTI ───────────
    const accessPayload = this.tokenService.verifyAccessToken(accessToken, true);

    if (!accessPayload) {
      // Signature is broken — reject immediately, no refresh attempt
      throw new UnauthorizedException('Invalid access token');
    }

    // ── Blacklist check for access token ─────────────────────────────────
    if (await this.redisService.isBlacklisted(accessPayload.jti)) {
      throw new UnauthorizedException('Access token has been revoked');
    }

    // ── Check whether the access token is still within its expiry ────────
    const now = Math.floor(Date.now() / 1000);
    const isAccessExpired = accessPayload.exp !== undefined && accessPayload.exp < now;

    if (!isAccessExpired) {
      // ── Happy path: valid, non-expired, non-blacklisted access token ───
      this.attachUser(req, accessPayload);
      return true;
    }

    // ── Access token expired — attempt silent refresh ────────────────────
    this.logger.debug(`Access token expired for user ${accessPayload.sub} — attempting silent refresh`);
    return this.handleSilentRefresh(req, res, refreshToken);
  }

  // ─── Silent Refresh ───────────────────────────────────────────────────────

  /**
   * Validate the refresh token, issue a new token pair, set new cookies,
   * and attach the user to the request so the original handler can proceed.
   */
  private async handleSilentRefresh(
    req: Request,
    res: Response,
    refreshToken: string | undefined,
  ): Promise<boolean> {
    if (!refreshToken) {
      throw new UnauthorizedException('Session expired — please log in again');
    }

    // Verify refresh token signature and expiry
    const refreshPayload = this.tokenService.verifyRefreshToken(refreshToken);
    if (!refreshPayload) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Check refresh token JTI against blacklist
    if (await this.redisService.isBlacklisted(refreshPayload.jti)) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    // Load user and compare refresh token against stored hash in DB
    const user = await this.authRepository.findById(refreshPayload.sub);
    if (!user?.refreshToken) {
      throw new UnauthorizedException('Session revoked — please log in again');
    }

    const isValid = await this.passwordService.comparePasswords(refreshToken, user.refreshToken);
    if (!isValid) {
      throw new UnauthorizedException('Refresh token mismatch');
    }

    // Blacklist the old refresh token so it cannot be reused
    const refreshTtlMs = refreshPayload.exp
      ? (refreshPayload.exp - Math.floor(Date.now() / 1000)) * 1000
      : this.REFRESH_TOKEN_MAX_AGE;
    await this.redisService.blacklist(refreshPayload.jti, refreshTtlMs);

    // Issue a new token pair
    const tokens = this.tokenService.generateTokenPair(user.id, user.email);

    // Persist hashed refresh token
    const hashedRefresh = await this.passwordService.hashPassword(tokens.refreshToken);
    await this.authRepository.setRefreshTokenHash(user.id, hashedRefresh);

    // Set fresh cookies — transparent to the client
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };

    res.cookie('accessToken', tokens.accessToken, {
      ...cookieOptions,
      maxAge: this.ACCESS_TOKEN_MAX_AGE,
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      ...cookieOptions,
      maxAge: this.REFRESH_TOKEN_MAX_AGE,
    });

    this.logger.debug(`Silent refresh succeeded for user ${user.id}`);

    // Attach user so downstream handlers can read req.user
    const newAccessPayload = this.tokenService.verifyAccessToken(tokens.accessToken);
    this.attachUser(req, newAccessPayload!);
    return true;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Attach a minimal user object to the request, matching the shape that
   * all controllers expect: { userId, email }
   */
  private attachUser(req: Request, payload: TokenPayload): void {
    (req as any).user = { userId: payload.sub, email: payload.email };
  }
}
