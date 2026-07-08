import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { TokenService, TokenPayload } from '../../modules/auth/service/token.service';
import { AuthRepository } from '../../modules/auth/repository/auth.repository';
import { PasswordService } from '../../modules/auth/service/password.service';
import { RedisService } from '../redis/redis.service';
import { setAuthCookies } from '../utils/cookie.helper';

/**
 * JwtAuthGuard
 *
 * Self-contained guard that:
 *  1. Reads accessToken from the HTTP-only cookie
 *  2. Checks JTI against the Redis blacklist
 *  3a. Valid, non-expired → checks isActive (Redis cache → DB fallback)
 *       → attaches { userId, email, role } → proceeds
 *  3b. Expired → silent refresh via refreshToken cookie:
 *       - Blacklist check
 *       - Verify signature + DB hash
 *       - isActive check
 *       - Rotate tokens, set new cookies
 *       - Attach user → proceeds
 *  4. Deactivated → 403
 *  5. Any other failure → 401
 *
 * isActive caching:
 *  The guard caches the isActive flag in Redis for 30 seconds to avoid
 *  a DB round-trip on every request. When an admin activates/deactivates
 *  a user the cache is invalidated immediately (see UserService).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly tokenService:    TokenService,
    private readonly authRepository:  AuthRepository,
    private readonly passwordService: PasswordService,
    private readonly redisService:    RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req  = http.getRequest<Request>();
    const res  = http.getResponse<Response>();

    const accessToken:  string | undefined = req.cookies?.accessToken;
    const refreshToken: string | undefined = req.cookies?.refreshToken;

    if (!accessToken) throw new UnauthorizedException('No access token provided');

    // Decode without expiry enforcement so we can read JTI for blacklist check
    const accessPayload = this.tokenService.verifyAccessToken(accessToken, true);
    if (!accessPayload) throw new UnauthorizedException('Invalid access token');

    if (await this.redisService.isBlacklisted(accessPayload.jti)) {
      throw new UnauthorizedException('Access token has been revoked');
    }

    const now       = Math.floor(Date.now() / 1000);
    const isExpired = accessPayload.exp !== undefined && accessPayload.exp < now;

    if (!isExpired) {
      await this.assertActive(accessPayload.sub);
      this.attachUser(req, accessPayload);
      return true;
    }

    this.logger.debug(`Access token expired for ${accessPayload.sub} — silent refresh`);
    return this.handleSilentRefresh(req, res, refreshToken);
  }

  // ─── Silent Refresh ───────────────────────────────────────────────────────

  private async handleSilentRefresh(
    req:          Request,
    res:          Response,
    refreshToken: string | undefined,
  ): Promise<boolean> {
    if (!refreshToken) throw new UnauthorizedException('Session expired — please log in again');

    const refreshPayload = this.tokenService.verifyRefreshToken(refreshToken);
    if (!refreshPayload) throw new UnauthorizedException('Invalid or expired refresh token');

    if (await this.redisService.isBlacklisted(refreshPayload.jti)) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    const user = await this.authRepository.findById(refreshPayload.sub);
    if (!user?.refreshToken) throw new UnauthorizedException('Session revoked — please log in again');

    if (!user.isActive) throw new ForbiddenException('Account is deactivated');

    const isValid = await this.passwordService.comparePasswords(refreshToken, user.refreshToken);
    if (!isValid) throw new UnauthorizedException('Refresh token mismatch');

    // Blacklist the consumed refresh token (rotation)
    const refreshTtlMs = refreshPayload.exp
      ? (refreshPayload.exp - Math.floor(Date.now() / 1000)) * 1000
      : 7 * 24 * 60 * 60 * 1000;
    await this.redisService.blacklist(refreshPayload.jti, refreshTtlMs);

    // Issue new token pair and update DB
    const tokens = this.tokenService.generateTokenPair(user.id, user.email, user.role);
    const hashedRefresh = await this.passwordService.hashPassword(tokens.refreshToken);
    await this.authRepository.setRefreshTokenHash(user.id, hashedRefresh);

    // Refresh the isActive cache with the freshly loaded user value
    await this.redisService.cacheActiveStatus(user.id, user.isActive);

    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    this.logger.debug(`Silent refresh succeeded for user ${user.id}`);

    const newPayload = this.tokenService.verifyAccessToken(tokens.accessToken)!;
    this.attachUser(req, newPayload);
    return true;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Check isActive with a Redis cache (30s TTL) to avoid a DB call on
   * every single authenticated request.
   *
   * Cache hit   → use cached value (max 30s stale)
   * Cache miss  → hit DB, populate cache for next 30s
   * Deactivated → 403 immediately
   */
  private async assertActive(userId: string): Promise<void> {
    // Try cache first
    const cached = await this.redisService.getCachedActiveStatus(userId);

    if (cached !== null) {
      if (!cached) throw new ForbiddenException('Account is deactivated');
      return; // cached and active — skip DB
    }

    // Cache miss — fall back to DB
    const user = await this.authRepository.findById(userId);

    if (user) {
      // Populate cache for the next 30 seconds
      await this.redisService.cacheActiveStatus(userId, user.isActive);
      if (!user.isActive) throw new ForbiddenException('Account is deactivated');
    }
  }

  /** Attach user context so controllers can use @Req() req.user or @CurrentUser() */
  private attachUser(req: Request, payload: TokenPayload): void {
    (req as any).user = {
      userId: payload.sub,
      email:  payload.email,
      role:   payload.role,
    };
  }
}
