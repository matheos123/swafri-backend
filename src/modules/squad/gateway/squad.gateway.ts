import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { SquadService } from '../service/squad.service';
import { GameService } from '../../game/service/game.service';
import { PrismaService } from '../../../prisma/prisma.service';

interface SquadQueueEntry {
  userId: string;
  username: string;
  socketId: string;
  walletAddress?: string | null;
  walletVerifiedAt?: Date | null;
}

interface SquadGameState {
  squadId: string;
  champion: SquadQueueEntry | null; // Current winner (stays to face next)
  challenger: SquadQueueEntry | null; // Next player in queue
  queue: SquadQueueEntry[]; // Waiting players
  currentRoomId: string | null; // Active game room
  isMatchInProgress: boolean;
}

@WebSocketGateway({
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
})
export class SquadGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(SquadGateway.name);
  
  // Map of squadId -> game state
  private squadGameStates = new Map<string, SquadGameState>();
  
  // Map of socketId -> squadId (for disconnect cleanup)
  private socketToSquad = new Map<string, string>();

  constructor(
    private readonly squadService: SquadService,
    @Inject(forwardRef(() => GameService))
    private readonly gameService: GameService,
    private readonly prisma: PrismaService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Squad gateway: Client connected ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const squadId = this.socketToSquad.get(client.id);
    if (squadId) {
      this.handlePlayerDisconnect(squadId, client.id);
      this.socketToSquad.delete(client.id);
    }
    this.logger.log(`Squad gateway: Client disconnected ${client.id}`);
  }

  // ─── Squad Queue Management ───────────────────────────────────────────────

  /**
   * Join squad game queue.
   * Emits: 'squad:queue_updated', 'squad:match_starting'
   */
  @SubscribeMessage('squad:join_queue')
  async handleJoinQueue(
    @MessageBody() data: { squadId: string; userId: string; username: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { squadId, userId, username } = data;

      // Verify user is a squad member
      const member = await this.squadService.getMemberRole(squadId, userId);
      if (!member) {
        client.emit('error', { message: 'You are not a member of this squad' });
        return;
      }

      // Get user details
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          walletAddress: true,
          walletVerifiedAt: true,
        },
      });

      // Initialize squad game state if not exists
      if (!this.squadGameStates.has(squadId)) {
        this.squadGameStates.set(squadId, {
          squadId,
          champion: null,
          challenger: null,
          queue: [],
          currentRoomId: null,
          isMatchInProgress: false,
        });
      }

      const state = this.squadGameStates.get(squadId)!;

      // Check if already in queue or playing
      const alreadyQueued = state.queue.some((p) => p.userId === userId);
      const isChampion = state.champion?.userId === userId;
      const isChallenger = state.challenger?.userId === userId;

      if (alreadyQueued || isChampion || isChallenger) {
        client.emit('error', { message: 'You are already in the queue or playing' });
        return;
      }

      const queueEntry: SquadQueueEntry = {
        userId,
        username,
        socketId: client.id,
        walletAddress: user?.walletAddress,
        walletVerifiedAt: user?.walletVerifiedAt,
      };

      // Add to queue
      state.queue.push(queueEntry);
      this.socketToSquad.set(client.id, squadId);

      // Make client join the squad room for broadcasts
      client.join(`squad:${squadId}`);

      this.logger.log(`${username} joined squad ${squadId} queue (position: ${state.queue.length})`);

      // Broadcast updated queue to all squad members
      this.broadcastQueueUpdate(squadId);

      // Try to start a match if possible
      await this.tryStartMatch(squadId);
    } catch (error) {
      this.logger.error('Error joining squad queue', error);
      client.emit('error', { message: 'Failed to join squad queue' });
    }
  }

  /**
   * Leave squad game queue.
   * Emits: 'squad:queue_updated'
   */
  @SubscribeMessage('squad:leave_queue')
  async handleLeaveQueue(
    @MessageBody() data: { squadId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { squadId, userId } = data;

      const state = this.squadGameStates.get(squadId);
      if (!state) {
        client.emit('error', { message: 'Squad queue not found' });
        return;
      }

      // Remove from queue
      state.queue = state.queue.filter((p) => p.userId !== userId);
      this.socketToSquad.delete(client.id);
      client.leave(`squad:${squadId}`);

      this.logger.log(`User ${userId} left squad ${squadId} queue`);

      // Broadcast updated queue
      this.broadcastQueueUpdate(squadId);
    } catch (error) {
      this.logger.error('Error leaving squad queue', error);
      client.emit('error', { message: 'Failed to leave squad queue' });
    }
  }

  /**
   * Get current queue status.
   * Emits: 'squad:queue_status'
   */
  @SubscribeMessage('squad:get_queue')
  async handleGetQueue(
    @MessageBody() data: { squadId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { squadId } = data;
    const state = this.squadGameStates.get(squadId);

    if (!state) {
      client.emit('squad:queue_status', {
        champion: null,
        challenger: null,
        queue: [],
        isMatchInProgress: false,
      });
      return;
    }

    client.emit('squad:queue_status', {
      champion: state.champion
        ? { userId: state.champion.userId, username: state.champion.username }
        : null,
      challenger: state.challenger
        ? { userId: state.challenger.userId, username: state.challenger.username }
        : null,
      queue: state.queue.map((p) => ({ userId: p.userId, username: p.username })),
      isMatchInProgress: state.isMatchInProgress,
    });
  }

  // ─── King of the Hill Logic ───────────────────────────────────────────────

  /**
   * Try to start a match in the squad (King of the Hill).
   * - If no champion and >= 2 in queue: first 2 become champion vs challenger
   * - If champion exists and >= 1 in queue: champion vs next in queue
   */
  private async tryStartMatch(squadId: string) {
    const state = this.squadGameStates.get(squadId);
    if (!state || state.isMatchInProgress) return;

    // Case 1: No current champion, need at least 2 players in queue
    if (!state.champion && state.queue.length >= 2) {
      state.champion = state.queue.shift()!;
      state.challenger = state.queue.shift()!;
      await this.startSquadMatch(squadId, state);
    }
    // Case 2: Champion exists (winner from previous match), next challenger
    else if (state.champion && state.queue.length >= 1) {
      state.challenger = state.queue.shift()!;
      await this.startSquadMatch(squadId, state);
    }
  }

  /**
   * Start a squad match between champion and challenger.
   */
  private async startSquadMatch(squadId: string, state: SquadGameState) {
    if (!state.champion || !state.challenger) return;

    state.isMatchInProgress = true;

    // Create game room using GameService
    const room = await this.gameService.createRoom(state.champion, state.challenger);
    state.currentRoomId = room.roomId;

    // Notify champion and challenger (they become active players)
    const championSocket = this.server.sockets.sockets.get(state.champion.socketId);
    const challengerSocket = this.server.sockets.sockets.get(state.challenger.socketId);

    if (championSocket) {
      championSocket.emit('squad:match_starting', {
        roomId: room.roomId,
        matchId: room.matchId,
        opponent: {
          userId: state.challenger.userId,
          username: state.challenger.username,
        },
        role: 'champion',
        isRanked: room.isRanked,
      });
    }

    if (challengerSocket) {
      challengerSocket.emit('squad:match_starting', {
        roomId: room.roomId,
        matchId: room.matchId,
        opponent: {
          userId: state.champion.userId,
          username: state.champion.username,
        },
        role: 'challenger',
        isRanked: room.isRanked,
      });
    }

    // Notify spectators (everyone else in the queue)
    this.server.to(`squad:${squadId}`).emit('squad:spectators_notified', {
      roomId: room.roomId,
      champion: { userId: state.champion.userId, username: state.champion.username },
      challenger: { userId: state.challenger.userId, username: state.challenger.username },
      message: 'Match in progress. You are spectating.',
    });

    this.logger.log(
      `Squad match started: ${state.champion.username} (champion) vs ${state.challenger.username} (challenger) in squad ${squadId}`,
    );

    this.broadcastQueueUpdate(squadId);
  }

  /**
   * Handle match end (called by game service or detected).
   * Winner becomes/stays champion, loser goes to back of queue.
   */
  async handleMatchEnd(squadId: string, winnerId: string | null) {
    const state = this.squadGameStates.get(squadId);
    if (!state || !state.champion || !state.challenger) return;

    state.isMatchInProgress = false;
    state.currentRoomId = null;

    if (!winnerId) {
      // Draw: both go to back of queue
      state.queue.push(state.champion);
      state.queue.push(state.challenger);
      state.champion = null;
      state.challenger = null;

      this.logger.log(`Squad match ended in draw: both players back to queue in ${squadId}`);
    } else if (winnerId === state.champion.userId) {
      // Champion won: stays champion, challenger to back of queue
      state.queue.push(state.challenger);
      state.challenger = null;

      this.logger.log(
        `Champion ${state.champion.username} won! Stays champion. Challenger to back of queue in ${squadId}`,
      );

      // Notify champion they stay
      const championSocket = this.server.sockets.sockets.get(state.champion.socketId);
      if (championSocket) {
        championSocket.emit('squad:champion_retained', {
          message: 'You remain the champion! Prepare for next challenger.',
        });
      }
    } else {
      // Challenger won: becomes new champion, old champion to back of queue
      const oldChampion = state.champion;
      state.champion = state.challenger;
      state.challenger = null;
      state.queue.push(oldChampion);

      this.logger.log(
        `New champion: ${state.champion.username}! Old champion ${oldChampion.username} to back of queue in ${squadId}`,
      );

      // Notify new champion
      const newChampionSocket = this.server.sockets.sockets.get(state.champion.socketId);
      if (newChampionSocket) {
        newChampionSocket.emit('squad:champion_changed', {
          message: 'You are the new champion!',
          username: state.champion.username,
        });
      }

      // Notify old champion
      const oldChampionSocket = this.server.sockets.sockets.get(oldChampion.socketId);
      if (oldChampionSocket) {
        oldChampionSocket.emit('squad:dethroned', {
          message: 'You have been dethroned. Back to the queue.',
        });
      }
    }

    // Broadcast updated queue
    this.broadcastQueueUpdate(squadId);

    // Try to start next match
    await this.tryStartMatch(squadId);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private broadcastQueueUpdate(squadId: string) {
    const state = this.squadGameStates.get(squadId);
    if (!state) return;

    this.server.to(`squad:${squadId}`).emit('squad:queue_updated', {
      champion: state.champion
        ? { userId: state.champion.userId, username: state.champion.username }
        : null,
      challenger: state.challenger
        ? { userId: state.challenger.userId, username: state.challenger.username }
        : null,
      queue: state.queue.map((p, index) => ({
        userId: p.userId,
        username: p.username,
        position: index + 1,
      })),
      isMatchInProgress: state.isMatchInProgress,
    });
  }

  private handlePlayerDisconnect(squadId: string, socketId: string) {
    const state = this.squadGameStates.get(squadId);
    if (!state) return;

    // Remove from queue
    const queueIndex = state.queue.findIndex((p) => p.socketId === socketId);
    if (queueIndex !== -1) {
      const removed = state.queue.splice(queueIndex, 1)[0];
      this.logger.log(`Player ${removed.username} disconnected from squad ${squadId} queue`);
      this.broadcastQueueUpdate(squadId);
      return;
    }

    // If champion disconnects mid-match, forfeit
    if (state.champion?.socketId === socketId && state.isMatchInProgress) {
      this.logger.warn(`Champion disconnected mid-match in squad ${squadId}`);
      // Challenger wins by default
      if (state.challenger) {
        this.handleMatchEnd(squadId, state.challenger.userId);
      }
    }

    // If challenger disconnects mid-match, forfeit
    if (state.challenger?.socketId === socketId && state.isMatchInProgress) {
      this.logger.warn(`Challenger disconnected mid-match in squad ${squadId}`);
      // Champion wins by default
      if (state.champion) {
        this.handleMatchEnd(squadId, state.champion.userId);
      }
    }
  }

  /**
   * Public method to be called by GameService when a match ends.
   */
  async notifyMatchEnd(roomId: string, winnerId: string | null) {
    // Find which squad this match belongs to
    for (const [squadId, state] of this.squadGameStates.entries()) {
      if (state.currentRoomId === roomId) {
        await this.handleMatchEnd(squadId, winnerId);
        return;
      }
    }
  }
}
