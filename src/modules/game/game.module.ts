import { Module } from '@nestjs/common';
import { GameController } from './controller/game.controller';
import { GameGateway } from './gateway/game.gateway';
import { GameService } from './service/game.service';

@Module({
  controllers: [GameController],
  providers: [GameService, GameGateway],
  exports: [GameService],
})
export class GameModule {}
