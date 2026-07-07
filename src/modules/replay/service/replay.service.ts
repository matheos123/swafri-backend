import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ReplayService {
  constructor(private readonly prisma: PrismaService) {}

  async getMatchReplay(matchId: string) {
    const match = await this.prisma.match.findUnique({ where: { id: matchId }, include: { rounds: { orderBy: { roundNumber: 'asc' } } } });
    if (!match) throw new NotFoundException(`Match ${matchId} not found`);

    const [p1, p2] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: match.player1Id }, select: { id: true, username: true, avatar: true } }),
      this.prisma.user.findUnique({ where: { id: match.player2Id }, select: { id: true, username: true, avatar: true } }),
    ]);

    return { matchId: match.id, roomId: match.roomId, player1: p1, player2: p2, winnerId: match.winnerId, status: match.status, onChainHash: match.onChainHash, rounds: match.rounds, createdAt: match.createdAt, endedAt: match.endedAt };
  }

  getMatchHistory(userId: string, limit = 20, offset = 0) {
    return this.prisma.match.findMany({
      where: { OR: [{ player1Id: userId }, { player2Id: userId }], status: 'COMPLETED' },
      include: { rounds: { orderBy: { roundNumber: 'asc' } } },
      orderBy: { createdAt: 'desc' }, take: limit, skip: offset,
    });
  }
}
