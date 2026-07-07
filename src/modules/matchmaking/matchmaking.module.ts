import { Module } from '@nestjs/common';
import { MatchmakingGateway } from './gateway/matchmaking.gateway';
import { MatchmakingService } from './service/matchmaking.service';
import { GameModule } from '../game/game.module';

@Module({
  imports: [GameModule],
  providers: [MatchmakingService, MatchmakingGateway],
})
export class MatchmakingModule {}
