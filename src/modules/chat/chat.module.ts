import { Module } from '@nestjs/common';
import { ChatGateway } from './gateway/chat.gateway';
import { ChatService } from './service/chat.service';

@Module({
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
