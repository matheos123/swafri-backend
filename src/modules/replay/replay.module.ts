import { Module } from '@nestjs/common';
import { ReplayController } from './controller/replay.controller';
import { ReplayService } from './service/replay.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports:     [AuthModule],
  controllers: [ReplayController],
  providers:   [ReplayService],
})
export class ReplayModule {}
