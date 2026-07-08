import { Module } from '@nestjs/common';
import { RewardModule } from '../reward/reward.module';
import { GameController } from './controller/game.controller';
import { GameGateway } from './gateway/game.gateway';
import { GameService } from './service/game.service';

@Module({
  imports: [RewardModule],
  controllers: [GameController],
  providers: [GameService, GameGateway],
  exports: [GameService],
})
export class GameModule {}
