import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AchievementService {
  private readonly logger = new Logger(AchievementService.name);

  constructor(private readonly prisma: PrismaService) {}

  getAllAchievements() {
    return this.prisma.achievement.findMany({ orderBy: { name: 'asc' } });
  }

  getUserAchievements(userId: string) {
    return this.prisma.userAchievement.findMany({ where: { userId }, include: { achievement: true }, orderBy: { earnedAt: 'desc' } });
  }

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
        await this.prisma.userAchievement.create({ data: { userId, achievementId: a.id } });
        newlyEarned.push(a.name);
        this.logger.log(`Achievement "${a.name}" unlocked for ${userId}`);
      }
    }
    return newlyEarned;
  }

  private evaluate(criteria: string, user: { wins: number; currentStreak: number; totalMatches: number }): boolean {
    const m = criteria.match(/^(\w+)\s*(>=|>|<=|<|===?)\s*(\d+)$/);
    if (!m) return false;
    const actual = user[m[1] as keyof typeof user] as number;
    const value = parseInt(m[3], 10);
    const op = m[2];
    if (actual === undefined) return false;
    return op === '>=' ? actual >= value : op === '>' ? actual > value : op === '<=' ? actual <= value : op === '<' ? actual < value : actual === value;
  }
}
