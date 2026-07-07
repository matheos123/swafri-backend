import { Module } from '@nestjs/common';
import { FriendController } from './controller/friend.controller';
import { FriendService } from './service/friend.service';

@Module({
  controllers: [FriendController],
  providers: [FriendService],
  exports: [FriendService],
})
export class FriendModule {}
