import { Module, forwardRef } from '@nestjs/common';
import { GameController } from './controller/game.controller';
import { GameGateway } from './gateway/game.gateway';
import { GameService } from './service/game.service';
import { AchievementModule } from '../achievement/achievement.module';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { NotificationModule } from '../notification/notification.module';
import { Web3Module } from '../../core/provider/web3.module';
import { FriendModule } from '../friend/friend.module';

@Module({
  imports: [
    AchievementModule,          // AchievementService
    LeaderboardModule,          // LeaderboardService
    NotificationModule,         // NotificationService
    Web3Module,                 // Web3Provider
    forwardRef(() => FriendModule), // FriendService (circular dependency)
  ],
  controllers: [GameController],
  providers:   [GameService, GameGateway],
  exports:     [GameService],
})
export class GameModule {}
