import { Module } from '@nestjs/common';
import { LeaderboardController } from './controller/leaderboard.controller';
import { LeaderboardService } from './service/leaderboard.service';

@Module({
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
