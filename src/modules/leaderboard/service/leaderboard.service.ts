import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getLeaderboard(limit = 50, offset = 0) {
    const users = await this.prisma.user.findMany({
      where: { totalMatches: { gt: 0 } },
      orderBy: [{ points: 'desc' }, { wins: 'desc' }],
      take: limit, skip: offset,
      select: { id: true, username: true, avatar: true, wins: true, losses: true, totalMatches: true, points: true, longestStreak: true, walletAddress: true },
    });
    return users.map((u, i) => ({
      rank: offset + i + 1, userId: u.id, username: u.username, avatar: u.avatar,
      wins: u.wins, losses: u.losses, totalMatches: u.totalMatches, points: u.points,
      winRate: u.totalMatches > 0 ? Math.round((u.wins / u.totalMatches) * 100) : 0,
      longestStreak: u.longestStreak, walletAddress: u.walletAddress,
    }));
  }

  async getPlayerRank(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return -1;
    return (await this.prisma.user.count({ where: { points: { gt: user.points } } })) + 1;
  }
}
