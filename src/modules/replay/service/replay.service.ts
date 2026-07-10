import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ReplayService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Full round-by-round replay for a single match.
   * Public — anyone can verify a match result.
   */
  async getMatchReplay(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where:   { id: matchId },
      include: { rounds: { orderBy: { roundNumber: 'asc' } } },
    });
    if (!match) throw new NotFoundException(`Match ${matchId} not found`);

    const [p1, p2, winner] = await Promise.all([
      this.prisma.user.findUnique({
        where:  { id: match.player1Id },
        select: { id: true, username: true, avatar: true, walletAddress: true, blockchainProfileId: true },
      }),
      this.prisma.user.findUnique({
        where:  { id: match.player2Id },
        select: { id: true, username: true, avatar: true, walletAddress: true, blockchainProfileId: true },
      }),
      match.winnerId
        ? this.prisma.user.findUnique({
            where:  { id: match.winnerId },
            select: { id: true, username: true },
          })
        : Promise.resolve(null),
    ]);

    return {
      matchId:     match.id,
      roomId:      match.roomId,
      isRanked:    match.isRanked,
      status:      match.status,
      player1:     p1,
      player2:     p2,
      winner:      winner ?? null,
      onChainHash: match.onChainHash,
      rounds:      match.rounds.map((r) => ({
        roundNumber:   r.roundNumber,
        player1Move:   r.player1Move,
        player2Move:   r.player2Move,
        roundWinnerId: r.roundWinnerId,
      })),
      createdAt: match.createdAt,
      endedAt:   match.endedAt,
    };
  }

  /**
   * Paginated match history for a player.
   * Only returns ranked matches — unranked are ephemeral.
   */
  async getMatchHistory(userId: string, limit = 20, offset = 0) {
    const matches = await this.prisma.match.findMany({
      where: {
        OR:      [{ player1Id: userId }, { player2Id: userId }],
        status:  'COMPLETED',
        isRanked: true,
      },
      include: {
        rounds: { orderBy: { roundNumber: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      take:    +limit,
      skip:    +offset,
    });

    const total = await this.prisma.match.count({
      where: {
        OR:      [{ player1Id: userId }, { player2Id: userId }],
        status:  'COMPLETED',
        isRanked: true,
      },
    });

    // Batch-fetch all unique opponent IDs
    const opponentIds = [...new Set(
      matches.map((m) => m.player1Id === userId ? m.player2Id : m.player1Id),
    )];

    const opponents = await this.prisma.user.findMany({
      where:  { id: { in: opponentIds } },
      select: { id: true, username: true, avatar: true, walletAddress: true },
    });
    const opponentMap = new Map(opponents.map((o) => [o.id, o]));

    return {
      total,
      limit:   +limit,
      offset:  +offset,
      matches: matches.map((m) => {
        const opponentId = m.player1Id === userId ? m.player2Id : m.player1Id;
        const opponent   = opponentMap.get(opponentId);
        const won        = m.winnerId === userId;
        const drew       = m.status === 'COMPLETED' && !m.winnerId;

        return {
          matchId:     m.id,
          isRanked:    m.isRanked,
          opponent,
          result:      drew ? 'draw' : won ? 'win' : 'loss',
          onChainHash: m.onChainHash,
          rounds:      m.rounds.map((r) => ({
            roundNumber:   r.roundNumber,
            player1Move:   r.player1Move,
            player2Move:   r.player2Move,
            roundWinnerId: r.roundWinnerId,
          })),
          playedAt: m.createdAt,
          endedAt:  m.endedAt,
        };
      }),
    };
  }
}
