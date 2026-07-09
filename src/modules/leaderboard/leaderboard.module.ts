import { Module } from '@nestjs/common';
import { LeaderboardController } from './controller/leaderboard.controller';
import { LeaderboardService } from './service/leaderboard.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
