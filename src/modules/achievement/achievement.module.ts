import { Module } from '@nestjs/common';
import { AchievementController } from './controller/achievement.controller';
import { AchievementService } from './service/achievement.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AchievementController],
  providers: [AchievementService],
  exports: [AchievementService],
})
export class AchievementModule {}
