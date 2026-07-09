import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { GameService, GameRoom, PlayerState } from '../../game/service/game.service';

export interface QueueEntry {
  userId:           string;
  username:         string;
  socketId:         string;
  walletAddress?:   string | null;
  walletVerifiedAt?: Date | null;
  joinedAt:         Date;
}

@Injectable()
export class MatchmakingService {
  private readonly logger = new Logger(MatchmakingService.name);
  private readonly queue: QueueEntry[] = [];

  constructor(
    private readonly gameService: GameService,
    private readonly prisma:      PrismaService,
  ) {}

  // ─── Queue Management ─────────────────────────────────────────────────────

  joinQueue(entry: QueueEntry): void {
    if (this.queue.find((e) => e.userId === entry.userId)) return;
    this.queue.push(entry);
    this.logger.log(`${entry.username} joined queue (size: ${this.queue.length})`);
  }

  leaveQueue(userId: string): void {
    const i = this.queue.findIndex((e) => e.userId === userId);
    if (i !== -1) this.queue.splice(i, 1);
  }

  // ─── Matchmaking ──────────────────────────────────────────────────────────

  async tryMatch(): Promise<{ room: GameRoom; player1: QueueEntry; player2: QueueEntry } | null> {
    if (this.queue.length < 2) return null;

    const p1 = this.queue.shift()!;
    const p2 = this.queue.shift()!;

    this.logger.log(`Matching ${p1.username} vs ${p2.username}`);

    // Fetch wallet data from DB so ranked logic has accurate walletVerifiedAt
    const [u1, u2] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: p1.userId }, select: { walletAddress: true, walletVerifiedAt: true } }),
      this.prisma.user.findUnique({ where: { id: p2.userId }, select: { walletAddress: true, walletVerifiedAt: true } }),
    ]);

    const player1: PlayerState = {
      userId:          p1.userId,
      username:        p1.username,
      socketId:        p1.socketId,
      walletAddress:   u1?.walletAddress ?? null,
      walletVerifiedAt: u1?.walletVerifiedAt ?? null,
    };

    const player2: PlayerState = {
      userId:          p2.userId,
      username:        p2.username,
      socketId:        p2.socketId,
      walletAddress:   u2?.walletAddress ?? null,
      walletVerifiedAt: u2?.walletVerifiedAt ?? null,
    };

    const room = await this.gameService.createRoom(player1, player2);
    return { room, player1: p1, player2: p2 };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  getQueueLength(): number { return this.queue.length; }
  isInQueue(userId: string): boolean { return this.queue.some((e) => e.userId === userId); }
}
