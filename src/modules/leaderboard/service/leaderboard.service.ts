import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the ranked leaderboard.
   * Only includes players with a verified wallet (walletVerifiedAt is set).
   * Ordered by points desc, then wins desc.
   */
  async getLeaderboard(limit = 50, offset = 0) {
    const users = await this.prisma.user.findMany({
      where: {
        walletVerifiedAt: { not: null },  // ranked players only
        totalMatches:     { gt: 0 },
        deletedAt:        null,
      },
      orderBy: [{ points: 'desc' }, { wins: 'desc' }],
      take:   limit,
      skip:   offset,
      select: {
        id:                  true,
        username:            true,
        avatar:              true,
        walletAddress:       true,
        blockchainProfileId: true,
        wins:                true,
        losses:              true,
        totalMatches:        true,
        points:              true,
        longestStreak:       true,
        currentStreak:       true,
      },
    });

    return users.map((u, i) => ({
      rank:                offset + i + 1,
      userId:              u.id,
      username:            u.username,
      avatar:              u.avatar,
      walletAddress:       u.walletAddress,
      blockchainProfileId: u.blockchainProfileId,
      wins:                u.wins,
      losses:              u.losses,
      totalMatches:        u.totalMatches,
      points:              u.points,
      currentStreak:       u.currentStreak,
      longestStreak:       u.longestStreak,
      winRate:             u.totalMatches > 0
        ? Math.round((u.wins / u.totalMatches) * 100)
        : 0,
    }));
  }

  /**
   * Get a specific player's current rank on the leaderboard.
   * Returns -1 if the player has no verified wallet or doesn't exist.
   */
  async getPlayerRank(userId: string): Promise<{ rank: number; points: number; totalRankedPlayers: number }> {
    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { points: true, walletVerifiedAt: true },
    });

    if (!user || !user.walletVerifiedAt) {
      return { rank: -1, points: 0, totalRankedPlayers: 0 };
    }

    const [rank, total] = await Promise.all([
      this.prisma.user.count({
        where: {
          points:           { gt: user.points },
          walletVerifiedAt: { not: null },
          deletedAt:        null,
        },
      }),
      this.prisma.user.count({
        where: {
          walletVerifiedAt: { not: null },
          deletedAt:        null,
        },
      }),
    ]);

    return {
      rank:                rank + 1,
      points:              user.points,
      totalRankedPlayers:  total,
    };
  }
}
