import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * VerifyService
 *
 * Public verification endpoints — the demo killer feature.
 *
 * A judge can take any matchId or blockchainProfileId,
 * hit these endpoints, and see cryptographic proof with
 * a block explorer link to verify independently.
 */
@Injectable()
export class VerifyService {
  private readonly EXPLORER_BASE = 'https://sepolia.basescan.org';

  constructor(private readonly prisma: PrismaService) {}

  // ─── Verify Match ─────────────────────────────────────────────────────────

  /**
   * Returns full match result with on-chain hash and verification instructions.
   * Anyone can independently verify the hash by computing:
   *   keccak256(matchId + player1Address + player2Address + winnerAddress + move1 + move2 + timestamp)
   */
  async verifyMatch(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where:   { id: matchId },
      include: { rounds: { orderBy: { roundNumber: 'asc' } } },
    });

    if (!match) throw new NotFoundException(`Match ${matchId} not found`);

    const [player1, player2, winner] = await Promise.all([
      this.prisma.user.findUnique({
        where:  { id: match.player1Id },
        select: { id: true, username: true, walletAddress: true, blockchainProfileId: true },
      }),
      this.prisma.user.findUnique({
        where:  { id: match.player2Id },
        select: { id: true, username: true, walletAddress: true, blockchainProfileId: true },
      }),
      match.winnerId
        ? this.prisma.user.findUnique({
            where:  { id: match.winnerId },
            select: { id: true, username: true, walletAddress: true },
          })
        : Promise.resolve(null),
    ]);

    return {
      matchId:       match.id,
      isRanked:      match.isRanked,
      status:        match.status,
      player1,
      player2,
      winner:        winner ?? null,
      result:        match.winnerId ? 'decisive' : 'draw',
      onChainHash:   match.onChainHash,
      blockExplorerUrl: match.onChainHash
        ? `${this.EXPLORER_BASE}/search?q=${match.onChainHash}`
        : null,
      rounds: match.rounds.map((r) => ({
        roundNumber:   r.roundNumber,
        player1Move:   r.player1Move,
        player2Move:   r.player2Move,
        roundWinnerId: r.roundWinnerId,
      })),
      playedAt: match.createdAt,
      endedAt:  match.endedAt,
      verifyInstructions: match.onChainHash
        ? [
            '1. The onChainHash is a keccak256 hash of the match result.',
            '2. You can search the hash on the block explorer link above.',
            '3. To independently verify: compute keccak256(matchId + player addresses + winner + moves + timestamp).',
            '4. If the hash matches, the result is cryptographically proven and tamper-proof.',
          ]
        : ['This match was played in simulation mode — no on-chain record exists.'],
    };
  }

  // ─── Verify Player ────────────────────────────────────────────────────────

  /**
   * Resolves a blockchainProfileId to a player's identity.
   * Returns their on-chain identity card with stats and achievements.
   */
  async verifyPlayer(profileId: string) {
    const user = await this.prisma.user.findFirst({
      where:   { blockchainProfileId: profileId, deletedAt: null },
      select: {
        id:                  true,
        username:            true,
        avatar:              true,
        walletAddress:       true,
        blockchainProfileId: true,
        walletVerifiedAt:    true,
        wins:                true,
        losses:              true,
        totalMatches:        true,
        points:              true,
        currentStreak:       true,
        longestStreak:       true,
        createdAt:           true,
        achievements: {
          select: {
            earnedAt:    true,
            achievement: { select: { name: true, description: true, iconUrl: true } },
          },
          orderBy: { earnedAt: 'desc' },
        },
      },
    });

    if (!user) throw new NotFoundException(`No player found with profile ID: ${profileId}`);

    return {
      profileId:           user.blockchainProfileId,
      username:            user.username,
      avatar:              user.avatar,
      walletAddress:       user.walletAddress,
      walletVerified:      Boolean(user.walletVerifiedAt),
      walletVerifiedAt:    user.walletVerifiedAt,
      blockExplorerUrl:    user.walletAddress
        ? `${this.EXPLORER_BASE}/address/${user.walletAddress}`
        : null,
      stats: {
        wins:          user.wins,
        losses:        user.losses,
        totalMatches:  user.totalMatches,
        points:        user.points,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        winRate:       user.totalMatches > 0
          ? Math.round((user.wins / user.totalMatches) * 100)
          : 0,
      },
      achievements:     user.achievements,
      achievementCount: user.achievements.length,
      memberSince:      user.createdAt,
    };
  }

  // ─── Verify by Wallet ─────────────────────────────────────────────────────

  /**
   * Resolves a wallet address to a player's identity.
   * Alternative to verifyPlayer when you have the wallet address but not the profileId.
   */
  async verifyWallet(walletAddress: string) {
    const user = await this.prisma.user.findFirst({
      where:  { walletAddress, deletedAt: null },
      select: { blockchainProfileId: true },
    });

    if (!user?.blockchainProfileId) {
      throw new NotFoundException(`No verified player found for wallet: ${walletAddress}`);
    }

    return this.verifyPlayer(user.blockchainProfileId);
  }
}
