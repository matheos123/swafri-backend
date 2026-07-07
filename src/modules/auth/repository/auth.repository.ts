import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { User } from '@prisma/client';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async setRefreshTokenHash(userId: string, hash: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { refreshToken: hash } });
  }

  async removeRefreshToken(userId: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { refreshToken: null } });
  }
}
