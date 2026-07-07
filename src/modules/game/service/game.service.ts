import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../../prisma/prisma.service';
import { RpsEngine, Move } from '../engine/rps.engine';

export type GameStatus = 'waiting' | 'in_progress' | 'completed' | 'abandoned';

export interface PlayerState {
  userId: string;
  username: string;
  socketId: string;
  move?: Move;
}

export interface Round {
  roundNumber: number;
  player1Move?: Move;
  player2Move?: Move;
  winnerId: string | null;
  completedAt?: Date;
}

export interface GameRoom {
  roomId: string;
  matchId: string;
  player1: PlayerState;
  player2: PlayerState;
  status: GameStatus;
  rounds: Round[];
  currentRound: number;
  player1Wins: number;
  player2Wins: number;
  winnerId?: string;
  onChainHash?: string;
  createdAt: Date;
}

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);
  private readonly rooms = new Map<string, GameRoom>();

  constructor(private readonly prisma: PrismaService) {}

  async createRoom(
    player1: PlayerState,
    player2: PlayerState,
  ): Promise<GameRoom> {
    const roomId = `room-${uuidv4()}`;
    const matchId = uuidv4();

    await this.prisma.match.create({
      data: { id: matchId, roomId, player1Id: player1.userId, player2Id: player2.userId, status: 'IN_PROGRESS' },
    });

    const room: GameRoom = {
      roomId, matchId, player1, player2,
      status: 'in_progress', rounds: [],
      currentRound: 1, player1Wins: 0, player2Wins: 0,
      createdAt: new Date(),
    };

    this.rooms.set(roomId, room);
    this.logger.log(`Room created: ${roomId} | ${player1.username} vs ${player2.username}`);
    return room;
  }

  submitMove(roomId: string, userId: string, move: Move): GameRoom {
    const room = this.getRoom(roomId);
    if (room.status !== 'in_progress') throw new BadRequestException('Game not in progress');
    if (!RpsEngine.isValidMove(move)) throw new BadRequestException(`Invalid move: ${move}`);

    const isP1 = room.player1.userId === userId;
    const isP2 = room.player2.userId === userId;
    if (!isP1 && !isP2) throw new BadRequestException('Player not in this room');

    if (isP1) {
      if (room.player1.move) throw new BadRequestException('Move already submitted');
      room.player1.move = move;
    } else {
      if (room.player2.move) throw new BadRequestException('Move already submitted');
      room.player2.move = move;
    }

    if (room.player1.move && room.player2.move) {
      this.resolveRound(room);
    }

    return room;
  }

  private resolveRound(room: GameRoom): void {
    const m1 = room.player1.move!;
    const m2 = room.player2.move!;
    const outcome = RpsEngine.resolveRound(m1, m2, room.player1.userId, room.player2.userId);

    room.rounds.push({ roundNumber: room.currentRound, player1Move: m1, player2Move: m2, winnerId: outcome.winnerId, completedAt: new Date() });

    if (outcome.result === 'player1') room.player1Wins++;
    if (outcome.result === 'player2') room.player2Wins++;

    this.prisma.matchMove.create({
      data: { matchId: room.matchId, roundNumber: room.currentRound, player1Move: m1, player2Move: m2, roundWinnerId: outcome.winnerId },
    }).catch((e) => this.logger.error('Persist round failed', e));

    const result = RpsEngine.resolveMatch(room.player1Wins, room.player2Wins, room.player1.userId, room.player2.userId);

    if (result.isComplete) {
      room.status = 'completed';
      room.winnerId = result.winnerId ?? undefined;
      this.finalizeMatch(room).catch((e) => this.logger.error('Finalize failed', e));
    } else {
      room.currentRound++;
      room.player1.move = undefined;
      room.player2.move = undefined;
    }
  }

  private async finalizeMatch(room: GameRoom): Promise<void> {
    await this.prisma.match.update({
      where: { id: room.matchId },
      data: { status: 'COMPLETED', winnerId: room.winnerId, endedAt: new Date() },
    });

    if (room.winnerId) {
      const loserId = room.winnerId === room.player1.userId ? room.player2.userId : room.player1.userId;
      await this.prisma.user.update({ where: { id: room.winnerId }, data: { wins: { increment: 1 }, totalMatches: { increment: 1 }, points: { increment: 10 }, currentStreak: { increment: 1 } } });
      await this.prisma.user.update({ where: { id: loserId }, data: { losses: { increment: 1 }, totalMatches: { increment: 1 }, currentStreak: 0 } });
    }

    this.logger.log(`Match ${room.matchId} complete — winner: ${room.winnerId ?? 'draw'}`);
  }

  getRoom(roomId: string): GameRoom {
    const room = this.rooms.get(roomId);
    if (!room) throw new NotFoundException(`Room ${roomId} not found`);
    return room;
  }

  getRoomCount(): number { return this.rooms.size; }
}
