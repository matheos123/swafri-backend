import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from '../service/chat.service';

@WebSocketGateway({
  cors: { origin: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:3000', credentials: true },
})
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly chatService: ChatService) {}

  // ─── Connection ───────────────────────────────────────────────────────────

  /**
   * Auto-join every connected client to the global lobby channel.
   */
  handleConnection(client: Socket): void {
    client.join('lobby');
  }

  // ─── Join Room ────────────────────────────────────────────────────────────

  /**
   * chat:join
   * Join a specific chat channel (game room or lobby).
   *
   * Payload: { roomId }
   *
   * Emits:
   *   → chat:joined    (to sender)  — joined confirmation + last 50 messages
   */
  @SubscribeMessage('chat:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ): Promise<void> {
    const { roomId } = data;
    client.join(roomId);

    const history = await this.chatService.getRoomHistory(roomId);
    client.emit('chat:joined', { roomId, history });

    this.logger.log(`Client ${client.id} joined chat room: ${roomId}`);
  }

  // ─── Send Message ─────────────────────────────────────────────────────────

  /**
   * chat:message
   * Send a message to a room (game room or 'lobby').
   *
   * Payload: { roomId, userId, username, content }
   *
   * Emits:
   *   → chat:message   (to room)   — message broadcasted to all in room
   */
  @SubscribeMessage('chat:message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string; username: string; content: string },
  ): Promise<void> {
    if (!data.content?.trim()) return;

    const msg = await this.chatService.saveMessage(
      data.roomId,
      data.userId,
      data.username,
      data.content.trim(),
    );

    this.server.to(data.roomId).emit('chat:message', {
      id:        msg.id,
      roomId:    data.roomId,
      userId:    data.userId,
      username:  data.username,
      content:   msg.content,
      timestamp: msg.createdAt.toISOString(),
    });
  }

  // ─── History ──────────────────────────────────────────────────────────────

  /**
   * chat:history
   * Fetch the last 50 messages for a room.
   *
   * Payload: { roomId }
   *
   * Emits:
   *   → chat:history   (to sender)  — array of messages
   */
  @SubscribeMessage('chat:history')
  async handleHistory(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ): Promise<void> {
    const history = await this.chatService.getRoomHistory(data.roomId);
    client.emit('chat:history', { roomId: data.roomId, messages: history });
  }
}
