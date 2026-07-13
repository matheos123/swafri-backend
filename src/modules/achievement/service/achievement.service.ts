import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Web3Provider } from '../../../core/provider/web3.provider';
import { QueueService } from '../../../core/queue/queue.service';

@Injectable()
export class AchievementService {
  private readonly logger = new Logger(AchievementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly web3:   Web3Provider,
    private readonly queueService: QueueService,
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
   *   2. Queue NFT minting job (persistent with retries) for wallet-verified users
   *
   * @returns object with badge names and total bonus points earned (20 points per badge per SRS)
   */
  async checkAndAward(userId: string): Promise<{ badges: string[]; bonusPoints: number }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { badges: [], bonusPoints: 0 };

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
        this.logger.log(`Achievement "${a.name}" unlocked for ${userId} — bonus: +20 points`);

        // Queue NFT minting job (persistent with retries) for wallet-verified users
        if (user.walletAddress && user.walletVerifiedAt) {
          this.queueService
            .mintBadgeOnChain(user.walletAddress, a.name)
            .then((jobId) =>
              this.logger.log(
                `Badge minting job queued: "${a.name}" for ${user.walletAddress} | Job ID: ${jobId}`,
              ),
            )
            .catch((err) =>
              this.logger.error(`Failed to queue badge minting job for "${a.name}"`, err),
            );
        }
      }
    }

    // SRS requirement: +20 points per achievement badge unlocked
    const bonusPoints = newlyEarned.length * 20;

    return { badges: newlyEarned, bonusPoints };
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
