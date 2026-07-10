import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Server } from 'socket.io';
import { PrismaService } from '../../../prisma/prisma.service';
import { RpsEngine, Move } from '../engine/rps.engine';
import { AchievementService } from '../../achievement/service/achievement.service';
import { NotificationService } from '../../notification/service/notification.service';
import { LeaderboardService } from '../../leaderboard/service/leaderboard.service';
import { Web3Provider } from '../../../core/provider/web3.provider';

export type GameStatus = 'waiting' | 'in_progress' | 'completed' | 'abandoned';

export interface PlayerState {
  userId: string;
  username: string;
  socketId: string;
  walletAddress?: string | null;
  walletVerifiedAt?: Date | null;
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
  isRanked: boolean;
  createdAt: Date;
}

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);
  private readonly rooms = new Map<string, GameRoom>();

  // Injected by GameGateway after server is ready
  private server?: Server;

  constructor(
    private readonly prisma:          PrismaService,
    private readonly achievementSvc:  AchievementService,
    private readonly notificationSvc: NotificationService,
    private readonly leaderboardSvc:  LeaderboardService,
    private readonly web3:            Web3Provider,
  ) {}

  // Called by GameGateway.afterInit so we have the socket server reference
  setServer(server: Server): void {
    this.server = server;
    this.notificationSvc.setServer(server);
  }

  // ─── Room Creation ────────────────────────────────────────────────────────

  async createRoom(player1: PlayerState, player2: PlayerState): Promise<GameRoom> {
    const roomId  = `room-${uuidv4()}`;
    const matchId = uuidv4();

    // A match is ranked only when BOTH players have a verified wallet
    const isRanked = Boolean(player1.walletVerifiedAt && player2.walletVerifiedAt);

    await this.prisma.match.create({
      data: {
        id:       matchId,
        roomId,
        player1Id: player1.userId,
        player2Id: player2.userId,
        status:   'IN_PROGRESS',
        isRanked,
      },
    });

    const room: GameRoom = {
      roomId, matchId, player1, player2,
      status: 'in_progress', rounds: [],
      currentRound: 1, player1Wins: 0, player2Wins: 0,
      isRanked, createdAt: new Date(),
    };

    this.rooms.set(roomId, room);
    this.logger.log(
      `Room created: ${roomId} | ${player1.username} vs ${player2.username} | ranked: ${isRanked}`,
    );
    return room;
  }

  // ─── Move Submission ──────────────────────────────────────────────────────

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

  // ─── Round Resolution ─────────────────────────────────────────────────────

  private resolveRound(room: GameRoom): void {
    const m1 = room.player1.move!;
    const m2 = room.player2.move!;
    const outcome = RpsEngine.resolveRound(m1, m2, room.player1.userId, room.player2.userId);

    room.rounds.push({
      roundNumber: room.currentRound,
      player1Move: m1,
      player2Move: m2,
      winnerId:    outcome.winnerId,
      completedAt: new Date(),
    });

    if (outcome.result === 'player1') room.player1Wins++;
    if (outcome.result === 'player2') room.player2Wins++;

    // Persist round async — non-blocking
    this.prisma.matchMove.create({
      data: {
        matchId:      room.matchId,
        roundNumber:  room.currentRound,
        player1Move:  m1,
        player2Move:  m2,
        roundWinnerId: outcome.winnerId,
      },
    }).catch((e) => this.logger.error('Persist round failed', e));

    const result = RpsEngine.resolveMatch(
      room.player1Wins, room.player2Wins,
      room.player1.userId, room.player2.userId,
    );

    if (result.isComplete) {
      room.status   = 'completed';
      room.winnerId = result.winnerId ?? undefined;
      this.finalizeMatch(room).catch((e) => this.logger.error('Finalize failed', e));
    } else {
      room.currentRound++;
      room.player1.move = undefined;
      room.player2.move = undefined;
    }
  }

  // ─── Match Finalization ───────────────────────────────────────────────────

  private async finalizeMatch(room: GameRoom): Promise<void> {
    const { matchId, winnerId, player1, player2, isRanked, rounds } = room;

    // Determine loser
    const loserId = winnerId
      ? (winnerId === player1.userId ? player2.userId : player1.userId)
      : null;

    // Always update match record
    await this.prisma.match.update({
      where: { id: matchId },
      data:  { status: 'COMPLETED', winnerId: winnerId ?? null, endedAt: new Date() },
    });

    // Compute deterministic result hash for this match
    const lastRound = rounds.at(-1);
    const winnerWallet = winnerId
      ? (winnerId === player1.userId ? player1.walletAddress ?? null : player2.walletAddress ?? null)
      : null;
    const loserWallet = loserId
      ? (loserId === player1.userId ? player1.walletAddress ?? null : player2.walletAddress ?? null)
      : null;

    const onChainHash = this.web3.computeMatchResultHash(
      matchId,
      player1.walletAddress ?? null,
      player2.walletAddress ?? null,
      winnerWallet,
      lastRound?.player1Move ?? 'unknown',
      lastRound?.player2Move ?? 'unknown',
    );

    room.onChainHash = onChainHash;

    // Store hash immediately in DB (deterministic — works in simulation too)
    await this.prisma.match.update({
      where: { id: matchId },
      data:  { onChainHash },
    });

    // Fire-and-forget on-chain recording for ranked matches with wallets
    if (isRanked && player1.walletAddress && player2.walletAddress) {
      this.web3
        .recordMatchOnChain(matchId, winnerWallet, loserWallet, onChainHash)
        .then((txHash) =>
          this.logger.log(`Match ${matchId} recorded on-chain. TxHash: ${txHash}`),
        )
        .catch((err) => this.logger.error('recordMatchOnChain error', err));
    }

    if (!isRanked) {
      // ── Unranked: emit "connect wallet" prompt, nothing else saved ──
      this.logger.log(`Unranked match ${matchId} complete — result not persisted`);

      // Prompt unverified players to connect their wallet
      const unverifiedPlayers = [player1, player2].filter((p) => !p.walletVerifiedAt);
      for (const p of unverifiedPlayers) {
        if (this.server) {
          const socket = this.server.sockets.sockets.get(p.socketId);
          socket?.emit('notification:live', {
            type:    'info',
            message: 'Connect your wallet to save your progress, appear on the leaderboard, and earn achievement badges!',
          });
        }
      }
      return;
    }

    // ── Ranked: persist stats, achievements, leaderboard push ──

    if (winnerId && loserId) {
      // Winner stats
      const winner = await this.prisma.user.update({
        where: { id: winnerId },
        data: {
          wins:          { increment: 1 },
          totalMatches:  { increment: 1 },
          points:        { increment: 10 },
          currentStreak: { increment: 1 },
        },
      });

      // Update longestStreak if beaten
      if (winner.currentStreak > winner.longestStreak) {
        await this.prisma.user.update({
          where: { id: winnerId },
          data:  { longestStreak: winner.currentStreak },
        });
      }

      // Loser stats — streak resets
      await this.prisma.user.update({
        where: { id: loserId },
        data: {
          losses:        { increment: 1 },
          totalMatches:  { increment: 1 },
          currentStreak: 0,
        },
      });
    } else {
      // Draw — both get totalMatches++
      await Promise.all([
        this.prisma.user.update({ where: { id: player1.userId }, data: { totalMatches: { increment: 1 } } }),
        this.prisma.user.update({ where: { id: player2.userId }, data: { totalMatches: { increment: 1 } } }),
      ]);
    }

    // Check and award achievements for both players
    const [p1Badges, p2Badges] = await Promise.all([
      this.achievementSvc.checkAndAward(player1.userId),
      this.achievementSvc.checkAndAward(player2.userId),
    ]);

    // Notify players of new badges
    for (const badge of p1Badges) {
      this.notificationSvc.broadcastAchievement(player1.socketId, badge);
    }
    for (const badge of p2Badges) {
      this.notificationSvc.broadcastAchievement(player2.socketId, badge);
    }

    // Push updated leaderboard to all connected clients
    if (this.server) {
      const top = await this.leaderboardSvc.getLeaderboard(50, 0);
      this.server.emit('leaderboard:update', top);
    }

    this.logger.log(`Ranked match ${matchId} complete — winner: ${winnerId ?? 'draw'} | hash: ${onChainHash}`);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  getRoom(roomId: string): GameRoom {
    const room = this.rooms.get(roomId);
    if (!room) throw new NotFoundException(`Room ${roomId} not found`);
    return room;
  }

  getRoomCount(): number { return this.rooms.size; }

  listActiveRooms(): { roomId: string; player1: string; player2: string; round: number; isRanked: boolean }[] {
    return Array.from(this.rooms.values())
      .filter((r) => r.status === 'in_progress')
      .map((r) => ({
        roomId:   r.roomId,
        player1:  r.player1.username,
        player2:  r.player2.username,
        round:    r.currentRound,
        isRanked: r.isRanked,
      }));
  }
}
