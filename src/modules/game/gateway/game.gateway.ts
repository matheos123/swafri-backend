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
import { GameService } from '../service/game.service';
import { Move } from '../engine/rps.engine';

@WebSocketGateway({
  cors: { origin: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:3000', credentials: true },
})
export class GameGateway implements OnGatewayInit {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(GameGateway.name);

  constructor(private readonly gameService: GameService) {}

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
}
