import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MatchmakingService } from '../service/matchmaking.service';
import { FriendService } from '../../friend/service/friend.service';

// Parse comma-separated origins for Socket.IO CORS
const socketOrigins = (process.env.SOCKET_CORS_ORIGIN || 'http://localhost:3000')
  .split(',').map((o) => o.trim());

@WebSocketGateway({
  cors: { origin: socketOrigins, credentials: true },
})
export class MatchmakingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(MatchmakingGateway.name);

  // Track userId → socketId so FriendService can look up online users
  private readonly socketToUser = new Map<string, string>();

  constructor(
    private readonly matchmakingService: MatchmakingService,
    private readonly friendService:      FriendService,
  ) {}

  // ─── Connection ───────────────────────────────────────────────────────────

  handleConnection(client: Socket): void {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  // ─── Disconnect ───────────────────────────────────────────────────────────

  handleDisconnect(client: Socket): void {
    const userId = this.socketToUser.get(client.id);
    if (userId) {
      this.matchmakingService.leaveQueue(userId);
      this.friendService.setUserOffline(userId);
      this.socketToUser.delete(client.id);
      this.logger.log(`Player ${userId} disconnected — removed from queue and online map`);
    }
  }

  // ─── Join Queue ───────────────────────────────────────────────────────────

  /**
   * matchmaking:join
   * Add player to the queue. If two players are ready, create a room.
   * Also marks the player as online for friend notifications.
   *
   * Payload: { userId, username }
   *
   * Emits:
   *   → matchmaking:queued   (to sender)  — position in queue
   *   → matchmaking:matched  (to both)    — roomId, matchId, opponent info, isRanked
   */
  @SubscribeMessage('matchmaking:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() raw: any,
  ): Promise<void> {
    // Postman sends payload as a JSON string — parse if needed
    const data: { userId: string; username: string } =
      typeof raw === 'string' ? JSON.parse(raw) :
      Array.isArray(raw)      ? raw[0]          : raw;

    this.logger.debug(`matchmaking:join parsed: userId=${data?.userId} username=${data?.username}`);

    // Track online status for friend notifications
    this.socketToUser.set(client.id, data.userId);
    this.friendService.setUserOnline(data.userId, client.id);

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

    // Prompt unranked players to connect their wallet
    if (!room.isRanked) {
      const unrankedMsg = {
        type:    'info',
        message: 'This is an unranked match. Connect your wallet to save stats and earn achievements.',
      };
      s1?.emit('notification:live', unrankedMsg);
      s2?.emit('notification:live', unrankedMsg);
    }

    this.logger.log(`Match created: ${room.roomId} | ranked: ${room.isRanked}`);
  }

  // ─── Cancel Queue ─────────────────────────────────────────────────────────

  @SubscribeMessage('matchmaking:cancel')
  handleCancel(
    @ConnectedSocket() client: Socket,
    @MessageBody() raw: any,
  ): void {
    const data: { userId: string } =
      typeof raw === 'string' ? JSON.parse(raw) :
      Array.isArray(raw)      ? raw[0]          : raw;

    this.matchmakingService.leaveQueue(data.userId);
    client.emit('matchmaking:cancelled', { message: 'You have left the queue.' });
  }
}
