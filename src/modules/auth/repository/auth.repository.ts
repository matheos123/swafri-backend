import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { User } from '@prisma/client';

/**
 * AuthRepository
 *
 * Data access layer for authentication-related operations.
 * OTP is no longer stored here — it lives in Redis (see RedisService).
 */
@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─── User Lookup ─────────────────────────────────────────────────────────

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  // ─── Refresh Token ────────────────────────────────────────────────────────

  async setRefreshTokenHash(userId: string, hash: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { refreshToken: hash } });
  }

  async removeRefreshToken(userId: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { refreshToken: null } });
  }

  // ─── Password ─────────────────────────────────────────────────────────────

  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { password: hashedPassword } });
  }
}
