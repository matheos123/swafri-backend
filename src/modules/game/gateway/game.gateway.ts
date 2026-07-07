import { Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from '../service/game.service';
import { Move } from '../engine/rps.engine';

@WebSocketGateway({ cors: { origin: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:3000', credentials: true } })
export class GameGateway {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(GameGateway.name);

  constructor(private readonly gameService: GameService) {}

  @SubscribeMessage('game:move')
  handleMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string; move: Move },
  ): void {
    const { roomId, userId, move } = data;
    try {
      const room = this.gameService.submitMove(roomId, userId, move);
      const bothMoved = room.rounds.at(-1)?.roundNumber === room.currentRound - 1;

      if (bothMoved || room.status === 'completed') {
        const last = room.rounds.at(-1)!;
        this.server.to(roomId).emit('game:round_result', {
          roundNumber: last.roundNumber, player1Move: last.player1Move,
          player2Move: last.player2Move, roundWinnerId: last.winnerId,
          player1Wins: room.player1Wins, player2Wins: room.player2Wins,
        });
        if (room.status === 'completed') {
          this.server.to(roomId).emit('game:match_result', {
            winnerId: room.winnerId ?? null, player1Wins: room.player1Wins,
            player2Wins: room.player2Wins, onChainHash: room.onChainHash ?? null, matchId: room.matchId,
          });
        } else {
          this.server.to(roomId).emit('game:next_round', { roundNumber: room.currentRound });
        }
      } else {
        client.emit('game:move_received', { roomId, round: room.currentRound });
        client.to(roomId).emit('game:opponent_moved', { roomId });
      }
    } catch (err: unknown) {
      client.emit('game:error', { message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  @SubscribeMessage('game:rematch')
  handleRematch(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string }): void {
    client.to(data.roomId).emit('game:rematch_requested', { socketId: client.id });
  }

  @SubscribeMessage('spectate:join')
  handleSpectate(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string }): void {
    try {
      const room = this.gameService.getRoom(data.roomId);
      client.join(data.roomId);
      client.emit('spectate:joined', {
        roomId: data.roomId,
        player1: { userId: room.player1.userId, username: room.player1.username },
        player2: { userId: room.player2.userId, username: room.player2.username },
        currentRound: room.currentRound, player1Wins: room.player1Wins,
        player2Wins: room.player2Wins, status: room.status,
      });
    } catch {
      client.emit('game:error', { message: 'Room not found' });
    }
  }
}
