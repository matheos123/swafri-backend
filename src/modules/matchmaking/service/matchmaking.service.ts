import { Injectable, Logger } from '@nestjs/common';
import { GameService, GameRoom } from '../../game/service/game.service';

interface QueueEntry { userId: string; username: string; socketId: string; joinedAt: Date; }

@Injectable()
export class MatchmakingService {
  private readonly logger = new Logger(MatchmakingService.name);
  private readonly queue: QueueEntry[] = [];

  constructor(private readonly gameService: GameService) {}

  joinQueue(entry: QueueEntry): void {
    if (this.queue.find((e) => e.userId === entry.userId)) return;
    this.queue.push(entry);
    this.logger.log(`${entry.username} joined queue (size: ${this.queue.length})`);
  }

  leaveQueue(userId: string): void {
    const i = this.queue.findIndex((e) => e.userId === userId);
    if (i !== -1) this.queue.splice(i, 1);
  }

  async tryMatch(): Promise<{ room: GameRoom; player1: QueueEntry; player2: QueueEntry } | null> {
    if (this.queue.length < 2) return null;
    const p1 = this.queue.shift()!;
    const p2 = this.queue.shift()!;
    this.logger.log(`Matching ${p1.username} vs ${p2.username}`);
    const room = await this.gameService.createRoom(
      { userId: p1.userId, username: p1.username, socketId: p1.socketId },
      { userId: p2.userId, username: p2.username, socketId: p2.socketId },
    );
    return { room, player1: p1, player2: p2 };
  }

  getQueueLength(): number { return this.queue.length; }
  isInQueue(userId: string): boolean { return this.queue.some((e) => e.userId === userId); }
}
