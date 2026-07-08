import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import Redis from 'ioredis';

/**
 * RedisService
 *
 * Manages the Redis connection and provides:
 * 1. Token blacklisting   — revoked JWTs keyed by JTI
 * 2. OTP storage          — hashed OTPs keyed by userId, auto-expiring
 * 3. isActive cache       — short-lived cache to avoid a DB call on every request
 *
 * All keys are namespaced to avoid collisions:
 *   bl:<jti>        — blacklisted token
 *   otp:<userId>    — hashed OTP for password reset
 *   active:<userId> — cached isActive flag
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

  private readonly BL_PREFIX     = 'bl:';
  private readonly OTP_PREFIX    = 'otp:';
  private readonly ACTIVE_PREFIX = 'active:';

  constructor(private readonly config: ConfigService) {}

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  onModuleInit() {
    this.client = new Redis({
      host: this.config.get<string>('redis.host') ?? 'localhost',
      port: this.config.get<number>('redis.port') ?? 6379,
      ...(this.config.get<string>('redis.password')
        ? { password: this.config.get<string>('redis.password') }
        : {}),
      db: this.config.get<number>('redis.db') ?? 0,
      retryStrategy: (times) => (times > 3 ? null : times * 500),
    });

    this.client.on('connect', () => this.logger.log('Redis connected'));
    this.client.on('error',   (err) => this.logger.error('Redis error', err.message));
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  // ─── Token Blacklist ──────────────────────────────────────────────────────

  /**
   * Add a token JTI to the blacklist with an auto-expiring TTL.
   * The entry expires when the token itself would have expired,
   * so stale entries are never accumulated.
   */
  async blacklist(jti: string, ttlMs: number): Promise<void> {
    if (ttlMs <= 0) return;
    const ttlSeconds = Math.ceil(ttlMs / 1000);
    await this.client.set(`${this.BL_PREFIX}${jti}`, '1', 'EX', ttlSeconds);
  }

  /** Returns true if the JTI has been revoked. */
  async isBlacklisted(jti: string): Promise<boolean> {
    return (await this.client.get(`${this.BL_PREFIX}${jti}`)) !== null;
  }

  // ─── OTP Storage ──────────────────────────────────────────────────────────

  /**
   * Store a hashed OTP for a user with an automatic TTL.
   *
   * The OTP is hashed with SHA-256 before storage so that a Redis
   * breach does not reveal valid OTPs.
   *
   * @param userId    - The user the OTP belongs to
   * @param otp       - Plain-text OTP (will be hashed before storing)
   * @param ttlSeconds - How long the OTP is valid (default 10 min)
   */
  async setOtp(userId: string, otp: string, ttlSeconds = 600): Promise<void> {
    const hashed = this.hashOtp(otp);
    await this.client.set(`${this.OTP_PREFIX}${userId}`, hashed, 'EX', ttlSeconds);
  }

  /**
   * Verify a plain-text OTP against the stored hash.
   * Returns true if it matches and has not expired.
   */
  async verifyOtp(userId: string, otp: string): Promise<boolean> {
    const stored = await this.client.get(`${this.OTP_PREFIX}${userId}`);
    if (!stored) return false;
    return stored === this.hashOtp(otp);
  }

  /**
   * Check whether an OTP entry still exists in Redis for a user.
   * Used by the reset-password step to guard against expiry after verify.
   */
  async otpExists(userId: string): Promise<boolean> {
    return (await this.client.exists(`${this.OTP_PREFIX}${userId}`)) === 1;
  }

  /**
   * Delete the OTP after successful use to prevent replay.
   */
  async deleteOtp(userId: string): Promise<void> {
    await this.client.del(`${this.OTP_PREFIX}${userId}`);
  }

  // ─── isActive Cache ───────────────────────────────────────────────────────

  /**
   * Cache a user's isActive flag.
   * TTL is kept short (30 s) so deactivation propagates quickly
   * without hitting the DB on every authenticated request.
   *
   * @param userId   - User ID
   * @param isActive - Current active status
   * @param ttlSeconds - Cache duration (default 30 s)
   */
  async cacheActiveStatus(userId: string, isActive: boolean, ttlSeconds = 30): Promise<void> {
    await this.client.set(
      `${this.ACTIVE_PREFIX}${userId}`,
      isActive ? '1' : '0',
      'EX',
      ttlSeconds,
    );
  }

  /**
   * Read the cached isActive flag.
   * Returns null when the cache has expired or was never set,
   * signalling the caller to fall back to the DB.
   */
  async getCachedActiveStatus(userId: string): Promise<boolean | null> {
    const val = await this.client.get(`${this.ACTIVE_PREFIX}${userId}`);
    if (val === null) return null;
    return val === '1';
  }

  /**
   * Invalidate the isActive cache immediately — called when an admin
   * activates or deactivates an account so the change takes effect
   * within one request cycle.
   */
  async invalidateActiveStatus(userId: string): Promise<void> {
    await this.client.del(`${this.ACTIVE_PREFIX}${userId}`);
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  /** SHA-256 hash of an OTP string. */
  private hashOtp(otp: string): string {
    return createHash('sha256').update(otp).digest('hex');
  }
}
