import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MatchmakingService } from '../service/matchmaking.service';

@WebSocketGateway({
  cors: { origin: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:3000', credentials: true },
})
export class MatchmakingGateway implements OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(MatchmakingGateway.name);

  constructor(private readonly matchmakingService: MatchmakingService) {}

  // ─── Join Queue ───────────────────────────────────────────────────────────

  /**
   * matchmaking:join
   * Add player to the queue. If two players are ready, create a room.
   *
   * Payload: { userId, username }
   *
   * Emits:
   *   → matchmaking:queued   (to sender)    — position in queue
   *   → matchmaking:matched  (to both)      — roomId, matchId, opponent info, isRanked
   */
  @SubscribeMessage('matchmaking:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; username: string },
  ): Promise<void> {
    this.matchmakingService.joinQueue({
      userId:   data.userId,
      username: data.username,
      socketId: client.id,
      joinedAt: new Date(),
    });

    client.emit('matchmaking:queued', {
      position: this.matchmakingService.getQueueLength(),
      message:  'You are in the queue. Looking for an opponent...',
    });

    const match = await this.matchmakingService.tryMatch();
    if (!match) return;

    const { room, player1, player2 } = match;

    // Join both players into the socket room
    const s1 = this.server.sockets.sockets.get(player1.socketId);
    const s2 = this.server.sockets.sockets.get(player2.socketId);
    if (s1) s1.join(room.roomId);
    if (s2) s2.join(room.roomId);

    const base = {
      roomId:   room.roomId,
      matchId:  room.matchId,
      isRanked: room.isRanked,
    };

    s1?.emit('matchmaking:matched', {
      ...base,
      opponent: { userId: player2.userId, username: player2.username },
    });

    s2?.emit('matchmaking:matched', {
      ...base,
      opponent: { userId: player1.userId, username: player1.username },
    });

    // If unranked, prompt both unverified players
    if (!room.isRanked) {
      s1?.emit('notification:live', {
        type:    'info',
        message: 'This is an unranked match. Connect your wallet to have your stats and achievements saved.',
      });
      s2?.emit('notification:live', {
        type:    'info',
        message: 'This is an unranked match. Connect your wallet to have your stats and achievements saved.',
      });
    }

    this.logger.log(`Match created: ${room.roomId} | ranked: ${room.isRanked}`);
  }

  // ─── Cancel Queue ─────────────────────────────────────────────────────────

  /**
   * matchmaking:cancel
   * Remove player from queue.
   */
  @SubscribeMessage('matchmaking:cancel')
  handleCancel(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ): void {
    this.matchmakingService.leaveQueue(data.userId);
    client.emit('matchmaking:cancelled', { message: 'You have left the queue.' });
  }

  // ─── Disconnect ───────────────────────────────────────────────────────────

  handleDisconnect(client: Socket): void {
    // Try to get userId from socket data (set by JWT middleware if auth is used)
    const userId = client.data?.userId ?? client.data?.user?.sub;
    if (userId) {
      this.matchmakingService.leaveQueue(userId);
      this.logger.log(`Player ${userId} disconnected — removed from queue`);
    }
  }
}
