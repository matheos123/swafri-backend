import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { User } from '@prisma/client';

@Injectable()
export class WalletRepository {
  constructor(private readonly prisma: PrismaService) {}

  connect(userId: string, walletAddress: string): Promise<User> {
    return this.prisma.user.update({ where: { id: userId }, data: { walletAddress } });
  }

  /** Connect wallet with cryptographic proof — sets walletVerifiedAt and blockchainProfileId */
  connectVerified(userId: string, walletAddress: string, blockchainProfileId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        walletAddress,
        walletVerifiedAt:    new Date(),
        blockchainProfileId,
      },
    });
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
