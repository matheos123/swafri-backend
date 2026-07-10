import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Web3Provider } from '../../../core/provider/web3.provider';

/**
 * VerifyService
 *
 * Public verification endpoints — the demo killer feature.
 *
 * A judge can take any matchId or blockchainProfileId,
 * hit these endpoints, and see cryptographic proof with
 * a block explorer link to verify independently.
 *
 * When contracts are deployed (PLAYER_PROFILE_ADDRESS, BATTLE_ARENA_ADDRESS set),
 * the response also includes live on-chain data pulled directly from the contracts.
 */
@Injectable()
export class VerifyService {
  private readonly EXPLORER_BASE = 'https://sepolia.basescan.org';

  constructor(
    private readonly prisma: PrismaService,
    private readonly web3:   Web3Provider,
  ) {}

  // ─── Verify Match ─────────────────────────────────────────────────────────

  /**
   * Returns full match result with on-chain hash, block explorer link,
   * and (when contract is deployed) live on-chain data from MatchRegistry.sol.
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

    // Fetch on-chain data if MatchRegistry contract is deployed
    const onChainData = match.onChainHash
      ? await this.web3.getMatchOnChain(matchId)
      : null;

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
      onChain: onChainData
        ? {
            winner:     onChainData.winner,
            loser:      onChainData.loser,
            resultHash: onChainData.resultHash,
            recordedAt: new Date(onChainData.timestamp * 1000).toISOString(),
            contractAddress: this.getContractUrl('match'),
          }
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
   * Also fetches live on-chain data from PlayerProfile.sol if deployed.
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

    // Fetch on-chain player data from PlayerProfile.sol if wallet is connected and contract deployed
    const onChainPlayer = user.walletAddress
      ? await this.web3.getPlayerOnChain(user.walletAddress)
      : null;

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
      onChain: onChainPlayer
        ? {
            profileId:      onChainPlayer.profileId,
            username:       onChainPlayer.username,
            registeredAt:   new Date(onChainPlayer.registeredAt * 1000).toISOString(),
            contractAddress: this.getContractUrl('player'),
          }
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

  // ─── Private Helpers ─────────────────────────────────────────────────────

  private getContractUrl(type: 'player' | 'match'): string | null {
    // These are just explorer URLs for the contracts themselves
    const addresses = {
      player: process.env.PLAYER_PROFILE_ADDRESS,
      match:  process.env.BATTLE_ARENA_ADDRESS,
    };
    const addr = addresses[type];
    return addr ? `${this.EXPLORER_BASE}/address/${addr}` : null;
  }
}
