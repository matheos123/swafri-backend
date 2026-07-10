import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Web3Provider } from '../../../core/provider/web3.provider';

@Injectable()
export class AchievementService {
  private readonly logger = new Logger(AchievementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly web3:   Web3Provider,
  ) {}

  getAllAchievements() {
    return this.prisma.achievement.findMany({ orderBy: { name: 'asc' } });
  }

  getUserAchievements(userId: string) {
    return this.prisma.userAchievement.findMany({
      where:   { userId },
      include: { achievement: true },
      orderBy: { earnedAt: 'desc' },
    });
  }

  /**
   * Evaluate which new achievements the user has earned and award them.
   * For each newly earned badge:
   *   1. Persist to DB (UserAchievement row)
   *   2. Fire-and-forget: mint ERC-1155 NFT on AchievementBadge.sol (only if user has a wallet)
   *
   * @returns array of newly earned badge names
   */
  async checkAndAward(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return [];

    const earned = new Set(
      (await this.prisma.userAchievement.findMany({ where: { userId }, select: { achievementId: true } }))
        .map((e) => e.achievementId),
    );

    const newlyEarned: string[] = [];

    for (const a of await this.prisma.achievement.findMany()) {
      if (earned.has(a.id)) continue;
      if (this.evaluate(a.criteria, user)) {
        // Persist achievement in DB
        await this.prisma.userAchievement.create({ data: { userId, achievementId: a.id } });
        newlyEarned.push(a.name);
        this.logger.log(`Achievement "${a.name}" unlocked for ${userId}`);

        // Fire-and-forget: mint NFT on-chain (only for wallet-verified users)
        if (user.walletAddress && user.walletVerifiedAt) {
          this.web3
            .mintBadgeOnChain(user.walletAddress, a.name)
            .then((txHash) =>
              this.logger.log(
                `Badge NFT minted on-chain: "${a.name}" for ${user.walletAddress}. TxHash: ${txHash}`,
              ),
            )
            .catch((err) =>
              this.logger.error(`mintBadgeOnChain failed for badge "${a.name}"`, err),
            );
        }
      }
    }

    return newlyEarned;
  }

  private evaluate(
    criteria: string,
    user: { wins: number; currentStreak: number; totalMatches: number },
  ): boolean {
    const m = criteria.match(/^(\w+)\s*(>=|>|<=|<|===?)\s*(\d+)$/);
    if (!m) return false;
    const actual = user[m[1] as keyof typeof user] as number;
    const value  = parseInt(m[3], 10);
    const op     = m[2];
    if (actual === undefined) return false;
    return op === '>=' ? actual >= value
         : op === '>'  ? actual >  value
         : op === '<=' ? actual <= value
         : op === '<'  ? actual <  value
         : actual === value;
  }
}
