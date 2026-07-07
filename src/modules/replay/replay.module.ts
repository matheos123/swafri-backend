import { Module } from '@nestjs/common';
import { ReplayController } from './controller/replay.controller';
import { ReplayService } from './service/replay.service';

@Module({
  controllers: [ReplayController],
  providers: [ReplayService],
})
export class ReplayModule {}
