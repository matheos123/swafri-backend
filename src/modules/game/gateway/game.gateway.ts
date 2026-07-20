import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService, PlayerState } from '../service/game.service';
import { Move } from '../engine/rps.engine';
import { FriendService } from '../../friend/service/friend.service';
import { NotificationService } from '../../notification/service/notification.service';
import { PrismaService } from '../../../prisma/prisma.service';

@WebSocketGateway({
  cors: { origin: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:3000', credentials: true },
})
export class GameGateway implements OnGatewayInit {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(GameGateway.name);

  constructor(
    private readonly gameService: GameService,
    private readonly friendService: FriendService,
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
  ) {}

  // Called once the socket server is ready — wire server into GameService
  afterInit(server: Server): void {
    this.gameService.setServer(server);
    this.logger.log('GameGateway initialized — server wired into GameService');
  }

  // ─── Move ─────────────────────────────────────────────────────────────────

  /**
   * game:move
   * Player submits their move for the current round.
   * Emits:
   *   → game:move_received     (to sender)         — move acknowledged, waiting for opponent
   *   → game:opponent_moved    (to opponent)        — opponent has moved (not what)
   *   → game:round_result      (to room)            — both moves revealed + round winner
   *   → game:next_round        (to room)            — advance to next round
   *   → game:match_result      (to room)            — match over: winner + onChainHash
   */
  @SubscribeMessage('game:move')
  handleMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() raw: any,
  ): void {
    const data: { roomId: string; userId: string; move: Move } = 
      typeof raw === 'string' ? JSON.parse(raw) :
      Array.isArray(raw)      ? raw[0]          : raw;
    const { roomId, userId, move } = data;
    try {
      const room = this.gameService.submitMove(roomId, userId, move);
      const roundResolved = room.rounds.at(-1)?.roundNumber === room.currentRound - 1
        || room.status === 'completed';

      if (roundResolved) {
        const last = room.rounds.at(-1)!;

        // Broadcast round result to everyone in room
        this.server.to(roomId).emit('game:round_result', {
          roundNumber:  last.roundNumber,
          player1Move:  last.player1Move,
          player2Move:  last.player2Move,
          roundWinnerId: last.winnerId,
          player1Wins:  room.player1Wins,
          player2Wins:  room.player2Wins,
        });

        if (room.status === 'completed') {
          // Match over — emit result to room
          this.server.to(roomId).emit('game:match_result', {
            winnerId:    room.winnerId ?? null,
            player1Wins: room.player1Wins,
            player2Wins: room.player2Wins,
            onChainHash: room.onChainHash ?? null,
            matchId:     room.matchId,
            isRanked:    room.isRanked,
          });
        } else {
          // Next round
          this.server.to(roomId).emit('game:next_round', { roundNumber: room.currentRound });
        }
      } else {
        // Only this player has moved so far
        client.emit('game:move_received', { roomId, round: room.currentRound });
        client.to(roomId).emit('game:opponent_moved', { roomId });
      }
    } catch (err: unknown) {
      client.emit('game:error', {
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  // ─── Rematch ──────────────────────────────────────────────────────────────

  /**
   * game:rematch
   * Request a rematch — forwards the request to the opponent.
   */
  @SubscribeMessage('game:rematch')
  handleRematch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ): void {
    client.to(data.roomId).emit('game:rematch_requested', { socketId: client.id });
  }

  // ─── Spectator ────────────────────────────────────────────────────────────

  /**
   * spectate:join
   * Join a room as a spectator — receives current game state snapshot.
   */
  @SubscribeMessage('spectate:join')
  handleSpectate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ): void {
    try {
      const room = this.gameService.getRoom(data.roomId);
      client.join(data.roomId);
      client.emit('spectate:joined', {
        roomId:      data.roomId,
        player1:     { userId: room.player1.userId, username: room.player1.username },
        player2:     { userId: room.player2.userId, username: room.player2.username },
        currentRound: room.currentRound,
        player1Wins: room.player1Wins,
        player2Wins: room.player2Wins,
        status:      room.status,
        isRanked:    room.isRanked,
      });
    } catch {
      client.emit('game:error', { message: 'Room not found or match has ended' });
    }
  }

  /**
   * spectate:reaction
   * Broadcast a floating reaction emoji from a spectator to all room listeners.
   */
  @SubscribeMessage('spectate:reaction')
  handleSpectateReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() raw: any,
  ): void {
    const data: { roomId: string; emoji: string; username?: string } =
      typeof raw === 'string' ? JSON.parse(raw) :
      Array.isArray(raw)      ? raw[0]          : raw;

    const { roomId, emoji, username } = data;
    if (!roomId || !emoji) return;

    this.server.to(roomId).emit('spectate:reaction_received', {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      roomId,
      emoji,
      username: username || 'Spectator',
    });
  }

  // ─── Active Rooms ─────────────────────────────────────────────────────────

  /**
   * game:list_rooms
   * Returns a list of all currently active game rooms.
   * Useful for spectator lobby.
   */
  @SubscribeMessage('game:list_rooms')
  handleListRooms(@ConnectedSocket() client: Socket): void {
    client.emit('game:rooms', this.gameService.listActiveRooms());
  }

  /**
   * game:reconnect
   * Handles client reconnection on page refresh/disconnect.
   * Restores user socket to their active game room and emits full match state.
   */
  @SubscribeMessage('game:reconnect')
  handleReconnect(
    @ConnectedSocket() client: Socket,
    @MessageBody() raw: any,
  ): void {
    const data: { userId: string } =
      typeof raw === 'string' ? JSON.parse(raw) :
      Array.isArray(raw)      ? raw[0]          : raw;

    const userId = data?.userId;
    if (!userId) return;

    const room = this.gameService.findActiveRoomByUserId(userId);
    if (!room) return;

    // Update socket ID for the reconnected player
    if (room.player1.userId === userId) {
      room.player1.socketId = client.id;
    } else if (room.player2.userId === userId) {
      room.player2.socketId = client.id;
    }

    client.join(room.roomId);

    const isPlayer1 = room.player1.userId === userId;
    const opponent = isPlayer1 ? room.player2 : room.player1;

    this.logger.log(`Player ${userId} reconnected to room ${room.roomId}`);

    client.emit('game:reconnected', {
      roomId: room.roomId,
      matchId: room.matchId,
      isRanked: room.isRanked,
      currentRound: room.currentRound,
      player1Wins: room.player1Wins,
      player2Wins: room.player2Wins,
      opponent: {
        userId: opponent.userId,
        username: opponent.username,
      },
    });
  }

  // ─── Friend Game Invite Response ──────────────────────────────────────────

  /**
   * game:invite_decline
   * Handles declining a friend game invite.
   */
  @SubscribeMessage('game:invite_decline')
  async handleInviteDecline(
    @ConnectedSocket() client: Socket,
    @MessageBody() raw: any,
  ): Promise<void> {
    const data: { fromUserId: string; toUserId: string } =
      typeof raw === 'string' ? JSON.parse(raw) :
      Array.isArray(raw)      ? raw[0]          : raw;

    const { fromUserId, toUserId } = data;

    try {
      const inviterSocket = this.friendService.getSocketId(fromUserId);
      const responder = await this.prisma.user.findUnique({
        where: { id: toUserId },
        select: { username: true },
      });

      if (inviterSocket) {
        await this.notificationService.sendToUser(
          inviterSocket,
          'game_invite_declined',
          `${responder?.username ?? 'Your friend'} declined your game invite`,
          { fromUserId: toUserId },
          fromUserId,
        );
      } else {
        await this.notificationService.sendToUserById(
          fromUserId,
          'game_invite_declined',
          `${responder?.username ?? 'Your friend'} declined your game invite`,
          { fromUserId: toUserId },
        );
      }

      client.emit('game:invite_declined', { message: 'Invite declined' });
    } catch (err: unknown) {
      this.logger.error('Error handling invite decline:', err);
    }
  }

  /**
   * game:invite_accept
   * Handles accepting a friend game invite.
   * Creates a private game room with both players.
   */
  @SubscribeMessage('game:invite_accept')
  async handleInviteAccept(
    @ConnectedSocket() client: Socket,
    @MessageBody() raw: any,
  ): Promise<void> {
    const data: { fromUserId: string; toUserId: string } =
      typeof raw === 'string' ? JSON.parse(raw) :
      Array.isArray(raw)      ? raw[0]          : raw;

    const { fromUserId, toUserId } = data;

    try {
      const inviterSocket = this.friendService.getSocketId(fromUserId);
      if (!inviterSocket) {
        client.emit('game:error', { message: 'Inviter is no longer online' });
        return;
      }

      // Fetch both users from DB
      const [inviter, responder] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: fromUserId },
          select: { username: true, walletAddress: true, walletVerifiedAt: true },
        }),
        this.prisma.user.findUnique({
          where: { id: toUserId },
          select: { username: true, walletAddress: true, walletVerifiedAt: true },
        }),
      ]);

      if (!inviter || !responder) {
        client.emit('game:error', { message: 'User not found' });
        return;
      }

      // Build PlayerState for both players
      const player1: PlayerState = {
        userId:          fromUserId,
        username:        inviter.username,
        socketId:        inviterSocket,
        walletAddress:   inviter.walletAddress,
        walletVerifiedAt: inviter.walletVerifiedAt,
      };

      const player2: PlayerState = {
        userId:          toUserId,
        username:        responder.username,
        socketId:        client.id,
        walletAddress:   responder.walletAddress,
        walletVerifiedAt: responder.walletVerifiedAt,
      };

      // Create the game room
      const room = await this.gameService.createRoom(player1, player2);

      // Join both sockets to the room
      const inviterSocketObj = this.server.sockets.sockets.get(inviterSocket);
      if (inviterSocketObj) inviterSocketObj.join(room.roomId);
      client.join(room.roomId);

      // Notify both players that the match is ready
      const matchData = {
        roomId:   room.roomId,
        matchId:  room.matchId,
        isRanked: room.isRanked,
        opponent: { userId: '', username: '' },
      };

      // Emit to inviter
      this.server.to(inviterSocket).emit('game:matched', {
        ...matchData,
        opponent: { userId: player2.userId, username: player2.username },
      });

      // Emit to responder
      client.emit('game:matched', {
        ...matchData,
        opponent: { userId: player1.userId, username: player1.username },
      });

      this.logger.log(`Friend game accepted: ${player1.username} vs ${player2.username} in ${room.roomId}`);
    } catch (err: unknown) {
      this.logger.error('Error handling invite accept:', err);
      client.emit('game:error', {
        message: err instanceof Error ? err.message : 'Failed to process invite response',
      });
    }
  }
}
