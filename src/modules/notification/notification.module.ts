import { Module } from '@nestjs/common';
import { NotificationController } from './controller/notification.controller';
import { NotificationService } from './service/notification.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports:     [AuthModule],
  controllers: [NotificationController],
  providers:   [NotificationService],
  exports:     [NotificationService],
})
export class NotificationModule {}
