import { Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from '../service/chat.service';

@WebSocketGateway({ cors: { origin: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:3000', credentials: true } })
export class ChatGateway {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly chatService: ChatService) {}

  @SubscribeMessage('chat:message')
  async handleMessage(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string; userId: string; username: string; content: string }): Promise<void> {
    if (!data.content?.trim()) return;
    const msg = await this.chatService.saveMessage(data.roomId, data.userId, data.username, data.content.trim());
    this.server.to(data.roomId).emit('chat:message', { id: msg.id, userId: data.userId, username: data.username, content: msg.content, timestamp: msg.createdAt.toISOString() });
  }

  @SubscribeMessage('chat:history')
  async handleHistory(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string }): Promise<void> {
    client.emit('chat:history', await this.chatService.getRoomHistory(data.roomId));
  }
}
