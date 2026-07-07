import { Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MatchmakingService } from '../service/matchmaking.service';

@WebSocketGateway({ cors: { origin: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:3000', credentials: true } })
export class MatchmakingGateway implements OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(MatchmakingGateway.name);

  constructor(private readonly matchmakingService: MatchmakingService) {}

  @SubscribeMessage('matchmaking:join')
  async handleJoin(@ConnectedSocket() client: Socket, @MessageBody() data: { userId: string; username: string }): Promise<void> {
    this.matchmakingService.joinQueue({ ...data, socketId: client.id, joinedAt: new Date() });
    client.emit('matchmaking:queued', { position: this.matchmakingService.getQueueLength() });

    const match = await this.matchmakingService.tryMatch();
    if (!match) return;

    const { room, player1, player2 } = match;
    const s1 = this.server.sockets.sockets.get(player1.socketId);
    const s2 = this.server.sockets.sockets.get(player2.socketId);
    if (s1) s1.join(room.roomId);
    if (s2) s2.join(room.roomId);

    const base = { roomId: room.roomId, matchId: room.matchId };
    s1?.emit('matchmaking:matched', { ...base, opponent: { userId: player2.userId, username: player2.username } });
    s2?.emit('matchmaking:matched', { ...base, opponent: { userId: player1.userId, username: player1.username } });
    this.logger.log(`Match created: ${room.roomId}`);
  }

  @SubscribeMessage('matchmaking:cancel')
  handleCancel(@ConnectedSocket() client: Socket, @MessageBody() data: { userId: string }): void {
    this.matchmakingService.leaveQueue(data.userId);
    client.emit('matchmaking:cancelled');
  }

  handleDisconnect(client: Socket): void {
    const userId = client.data?.user?.sub;
    if (userId) this.matchmakingService.leaveQueue(userId);
  }
}
