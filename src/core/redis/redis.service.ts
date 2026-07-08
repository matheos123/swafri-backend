import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * RedisService
 *
 * Manages the Redis connection and provides token blacklisting operations.
 *
 * Used by the JwtAuthGuard to:
 * - Blacklist access tokens on logout (TTL = remaining token lifetime)
 * - Blacklist refresh tokens on logout or after rotation
 * - Check whether an incoming token has been revoked before trusting it
 *
 * Keys are prefixed with "bl:" (blacklist) to avoid collisions with
 * any other data that may be stored in the same Redis instance.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

  // Prefix for all blacklist keys
  private readonly BL_PREFIX = 'bl:';

  constructor(private readonly config: ConfigService) {}

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  onModuleInit() {
    this.client = new Redis({
      host: this.config.get<string>('redis.host') ?? 'localhost',
      port: this.config.get<number>('redis.port') ?? 6379,
      // Only pass password if it is actually set
      ...(this.config.get<string>('redis.password')
        ? { password: this.config.get<string>('redis.password') }
        : {}),
      db: this.config.get<number>('redis.db') ?? 0,
      // Retry strategy — give up after 3 failed attempts so the app
      // still starts even when Redis is unavailable
      retryStrategy: (times) => (times > 3 ? null : times * 500),
    });

    this.client.on('connect', () => this.logger.log('Redis connected'));
    this.client.on('error', (err) =>
      this.logger.error('Redis connection error', err.message),
    );
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  // ─── Blacklisting ─────────────────────────────────────────────────────────

  /**
   * Add a token JTI to the blacklist.
   *
   * The entry expires automatically once the token itself would have expired,
   * so the blacklist never accumulates stale entries.
   *
   * @param jti   - Unique JWT ID (from token payload)
   * @param ttlMs - Remaining lifetime of the token in milliseconds
   */
  async blacklist(jti: string, ttlMs: number): Promise<void> {
    if (ttlMs <= 0) return; // already expired — no need to store

    const ttlSeconds = Math.ceil(ttlMs / 1000);
    await this.client.set(`${this.BL_PREFIX}${jti}`, '1', 'EX', ttlSeconds);
  }

  /**
   * Check whether a token JTI is blacklisted.
   *
   * @param jti - Unique JWT ID to check
   * @returns true if the token has been revoked
   */
  async isBlacklisted(jti: string): Promise<boolean> {
    const val = await this.client.get(`${this.BL_PREFIX}${jti}`);
    return val !== null;
  }
}
