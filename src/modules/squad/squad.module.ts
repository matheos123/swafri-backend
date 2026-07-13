import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { SquadService } from './service/squad.service';
import { SquadController } from './controller/squad.controller';
import { SquadGateway } from './gateway/squad.gateway';
import { GameModule } from '../game/game.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [PrismaModule, forwardRef(() => GameModule), ChatModule],
  controllers: [SquadController],
  providers: [SquadService, SquadGateway],
  exports: [SquadService, SquadGateway],
})
export class SquadModule {}
