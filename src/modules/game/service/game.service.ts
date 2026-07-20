import { BadRequestException, Inject, Injectable, Logger, NotFoundException, forwardRef } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Server } from 'socket.io';
import { PrismaService } from '../../../prisma/prisma.service';
import { RpsEngine, Move } from '../engine/rps.engine';
import { AchievementService } from '../../achievement/service/achievement.service';
import { NotificationService } from '../../notification/service/notification.service';
import { LeaderboardService } from '../../leaderboard/service/leaderboard.service';
import { Web3Provider } from '../../../core/provider/web3.provider';
import { QueueService } from '../../../core/queue/queue.service';
import { SquadGateway } from '../../squad/gateway/squad.gateway';

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
    private readonly prisma: PrismaService,
    private readonly achievementSvc: AchievementService,
    private readonly notificationSvc: NotificationService,
    private readonly leaderboardSvc: LeaderboardService,
    private readonly web3: Web3Provider,
    private readonly queueService: QueueService,
    @Inject(forwardRef(() => SquadGateway))
    private readonly squadGateway: SquadGateway,
  ) { }

  // Called by GameGateway.afterInit so we have the socket server reference
  setServer(server: Server): void {
    this.server = server;
    this.notificationSvc.setServer(server);
  }

  // ─── Room Creation ────────────────────────────────────────────────────────

  async createRoom(player1: PlayerState, player2: PlayerState): Promise<GameRoom> {
    const roomId = `room-${uuidv4()}`;
    const matchId = uuidv4();

    // A match is fully ranked only when BOTH players have a verified wallet
    // But we still save stats for individual verified players (hybrid mode)
    const isRanked = Boolean(player1.walletVerifiedAt && player2.walletVerifiedAt);

    await this.prisma.match.create({
      data: {
        id: matchId,
        roomId,
        player1Id: player1.userId,
        player2Id: player2.userId,
        status: 'IN_PROGRESS',
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
      winnerId: outcome.winnerId,
      completedAt: new Date(),
    });

    if (outcome.result === 'player1') room.player1Wins++;
    if (outcome.result === 'player2') room.player2Wins++;

    // Persist round async — non-blocking
    this.prisma.matchMove.create({
      data: {
        matchId: room.matchId,
        roundNumber: room.currentRound,
        player1Move: m1,
        player2Move: m2,
        roundWinnerId: outcome.winnerId,
      },
    }).catch((e) => this.logger.error('Persist round failed', e));

    const result = RpsEngine.resolveMatch(
      room.player1Wins, room.player2Wins,
      room.player1.userId, room.player2.userId,
    );

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
      data: { status: 'COMPLETED', winnerId: winnerId ?? null, endedAt: new Date() },
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
      data: { onChainHash },
    });

    // Check which players have verified wallets
    const player1HasWallet = Boolean(player1.walletVerifiedAt);
    const player2HasWallet = Boolean(player2.walletVerifiedAt);
    const anyWalletConnected = player1HasWallet || player2HasWallet;

    // Queue on-chain recording if AT LEAST ONE player has wallet
    // This allows verified players to have their achievements on blockchain
    // even when playing against unverified opponents
    if (anyWalletConnected) {
      this.queueService
        .recordMatchOnChain(matchId, winnerWallet, loserWallet, onChainHash)
        .then((jobId) =>
          this.logger.log(`[BLOCKCHAIN] Match ${matchId} queued for on-chain recording: ${jobId}`),
        )
        .catch((err) => this.logger.error('[BLOCKCHAIN] Failed to queue job', err));
    }

    if (!anyWalletConnected) {
      // ── Practice mode: No wallets connected, nothing saved ──
      this.logger.log(`Practice match ${matchId} complete — no stats saved`);

      // Prompt both players to connect their wallet
      for (const p of [player1, player2]) {
        if (this.server) {
          const socket = this.server.sockets.sockets.get(p.socketId);
          socket?.emit('notification:live', {
            type: 'info',
            message: 'Connect your wallet to save your progress, appear on the leaderboard, and earn achievement badges!',
          });
        }
      }
      return;
    }

    // ── Hybrid/Ranked mode: Save stats for players with wallets ──
    this.logger.log(`Match ${matchId} complete — saving stats for verified players`);

    if (winnerId && loserId) {
      // Update winner stats (if wallet connected)
      const isWinnerVerified =
        (winnerId === player1.userId && player1HasWallet) ||
        (winnerId === player2.userId && player2HasWallet);

      if (isWinnerVerified) {
        const winner = await this.prisma.user.update({
          where: { id: winnerId },
          data: {
            wins: { increment: 1 },
            totalMatches: { increment: 1 },
            points: { increment: 10 },
            currentStreak: { increment: 1 },
          },
        });

        // Update longestStreak if beaten
        if (winner.currentStreak > winner.longestStreak) {
          await this.prisma.user.update({
            where: { id: winnerId },
            data: { longestStreak: winner.currentStreak },
          });
        }

        this.logger.log(`[STATS] Winner ${winnerId} awarded +10 points (streak: ${winner.currentStreak})`);
      }

      // Update loser stats (if wallet connected) — streak resets
      const isLoserVerified =
        (loserId === player1.userId && player1HasWallet) ||
        (loserId === player2.userId && player2HasWallet);

      if (isLoserVerified) {
        await this.prisma.user.update({
          where: { id: loserId },
          data: {
            losses: { increment: 1 },
            totalMatches: { increment: 1 },
            currentStreak: 0,
          },
        });

        this.logger.log(`[STATS] Loser ${loserId} streak reset to 0`);
      }

      // Prompt unverified player to connect wallet
      if (!isWinnerVerified && this.server) {
        const winnerPlayer = winnerId === player1.userId ? player1 : player2;
        const socket = this.server.sockets.sockets.get(winnerPlayer.socketId);
        socket?.emit('notification:live', {
          type: 'success',
          message: 'You won! Connect your wallet to save your progress and earn rewards!',
        });
      }

      if (!isLoserVerified && this.server) {
        const loserPlayer = loserId === player1.userId ? player1 : player2;
        const socket = this.server.sockets.sockets.get(loserPlayer.socketId);
        socket?.emit('notification:live', {
          type: 'info',
          message: 'Connect your wallet to save your match history and compete on the leaderboard!',
        });
      }
    } else {
      // Draw — increment totalMatches for verified players only
      const updates: Promise<any>[] = [];

      if (player1HasWallet) {
        updates.push(
          this.prisma.user.update({
            where: { id: player1.userId },
            data: { totalMatches: { increment: 1 } }
          })
        );
      }

      if (player2HasWallet) {
        updates.push(
          this.prisma.user.update({
            where: { id: player2.userId },
            data: { totalMatches: { increment: 1 } }
          })
        );
      }

      await Promise.all(updates);
      this.logger.log(`[STATS] Draw — totalMatches updated for verified players`);
    }

    // Check and award achievements ONLY for verified players
    const achievementPromises: Promise<any>[] = [];

    if (player1HasWallet) {
      achievementPromises.push(
        this.achievementSvc.checkAndAward(player1.userId).then((result) => {
          return { player: player1, result };
        })
      );
    }

    if (player2HasWallet) {
      achievementPromises.push(
        this.achievementSvc.checkAndAward(player2.userId).then((result) => {
          return { player: player2, result };
        })
      );
    }

    const achievementResults = await Promise.all(achievementPromises);

    // Award bonus points for newly unlocked achievements (SRS: +20 per badge)
    for (const { player, result } of achievementResults) {
      if (result.bonusPoints > 0) {
        await this.prisma.user.update({
          where: { id: player.userId },
          data: { points: { increment: result.bonusPoints } },
        });
        this.logger.log(`[ACHIEVEMENT] Player ${player.username} earned ${result.bonusPoints} bonus points from ${result.badges.length} badge(s)`);
      }

      // Notify player of new badges
      for (const badge of result.badges) {
        this.notificationSvc.broadcastAchievement(player.socketId, badge);
      }
    }

    // Push updated leaderboard to all connected clients
    if (this.server) {
      const top = await this.leaderboardSvc.getLeaderboard(50, 0);
      this.server.emit('leaderboard:update', top);
    }

    this.logger.log(`Ranked match ${matchId} complete — winner: ${winnerId ?? 'draw'} | hash: ${onChainHash}`);

    // Notify squad gateway if this match was part of a squad queue
    try {
      await this.squadGateway.notifyMatchEnd(room.roomId, winnerId ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to notify squad gateway: ${message}`);
    }
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
        roomId: r.roomId,
        player1: r.player1.username,
        player2: r.player2.username,
        round: r.currentRound,
        isRanked: r.isRanked,
      }));
  }

  findActiveRoomByUserId(userId: string): GameRoom | undefined {
    return Array.from(this.rooms.values()).find(
      (r) =>
        r.status === 'in_progress' &&
        (r.player1.userId === userId || r.player2.userId === userId),
    );
  }
}
