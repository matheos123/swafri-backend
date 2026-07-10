import { Module } from '@nestjs/common';
import { MatchmakingGateway } from './gateway/matchmaking.gateway';
import { MatchmakingService } from './service/matchmaking.service';
import { GameModule } from '../game/game.module';
import { FriendModule } from '../friend/friend.module';

@Module({
  imports:   [GameModule, FriendModule],
  providers: [MatchmakingService, MatchmakingGateway],
})
export class MatchmakingModule {}
