import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { User } from '@prisma/client';

@Injectable()
export class WalletRepository {
  constructor(private readonly prisma: PrismaService) {}

  connect(userId: string, walletAddress: string): Promise<User> {
    return this.prisma.user.update({ where: { id: userId }, data: { walletAddress } });
  }

  disconnect(userId: string): Promise<User> {
    return this.prisma.user.update({ where: { id: userId }, data: { walletAddress: null } });
  }

  findByWallet(walletAddress: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { walletAddress } });
  }

  findByUserId(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }
}
