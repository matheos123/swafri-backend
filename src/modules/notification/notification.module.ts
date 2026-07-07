import { Module } from '@nestjs/common';
import { NotificationService } from './service/notification.service';

@Module({
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
