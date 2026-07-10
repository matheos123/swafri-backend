import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { PrismaService } from '../../../prisma/prisma.service';

export type NotificationType =
  | 'friend_request'
  | 'friend_accepted'
  | 'game_invite'
  | 'game_invite_declined'
  | 'achievement_earned'
  | 'match_found';

// Maps our string type to the Prisma enum
const TYPE_MAP: Record<NotificationType, string> = {
  friend_request:       'FRIEND_REQUEST',
  friend_accepted:      'FRIEND_ACCEPTED',
  game_invite:          'GAME_INVITE',
  game_invite_declined: 'GAME_INVITE_DECLINED',
  achievement_earned:   'ACHIEVEMENT_EARNED',
  match_found:          'MATCH_FOUND',
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private server!: Server;

  constructor(private readonly prisma: PrismaService) {}

  setServer(server: Server): void {
    this.server = server;
  }

  // ─── Send + Persist ───────────────────────────────────────────────────────

  /**
   * Send a real-time notification to a specific socket AND persist it to DB.
   * If the user is offline the notification is stored and retrieved on next login.
   *
   * @param userId    - the user who should receive the notification (for DB)
   * @param socketId  - their current socket ID (for real-time delivery)
   * @param type      - notification type
   * @param message   - human-readable message
   * @param data      - optional extra payload
   */
  async sendToUser(
    socketId: string,
    type: NotificationType,
    message: string,
    data?: Record<string, unknown>,
    userId?: string,
  ): Promise<void> {
    // Real-time delivery
    this.server?.to(socketId).emit('notification:live', { type, message, data });

    // Persist to DB if userId provided
    if (userId) {
      await this.persist(userId, type, message, data).catch((e) =>
        this.logger.error('Failed to persist notification', e),
      );
    }
  }

  /**
   * Persist a notification for a user by userId only (no socket delivery).
   * Used when user is offline — they'll fetch it on next login.
   */
  async sendToUserById(
    userId: string,
    type: NotificationType,
    message: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    await this.persist(userId, type, message, data).catch((e) =>
      this.logger.error('Failed to persist notification', e),
    );
  }

  broadcastAchievement(socketId: string, achievementName: string, userId?: string): void {
    this.sendToUser(
      socketId,
      'achievement_earned',
      `Achievement unlocked: "${achievementName}"`,
      { achievementName },
      userId,
    );
  }

  sendToRoom(roomId: string, type: NotificationType, message: string): void {
    this.server?.to(roomId).emit('notification:live', { type, message });
  }

  // ─── Read Notifications ───────────────────────────────────────────────────

  /**
   * Get all notifications for a user.
   * Returns unread first, then read, ordered by createdAt desc.
   */
  async getForUser(userId: string, limit = 50, offset = 0) {
    const [notifications, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where:   { userId },
        orderBy: [{ read: 'asc' }, { createdAt: 'desc' }],
        take:    +limit,
        skip:    +offset,
      }),
      this.prisma.notification.count({
        where: { userId, read: false },
      }),
    ]);

    return { notifications, unreadCount, limit: +limit, offset: +offset };
  }

  /**
   * Mark one notification as read.
   */
  async markRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data:  { read: true },
    });
  }

  /**
   * Mark all notifications as read for a user.
   */
  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data:  { read: true },
    });
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private async persist(
    userId:  string,
    type:    NotificationType,
    message: string,
    data?:   Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId,
        type:    TYPE_MAP[type] as any,
        message,
        data:    data ? (data as any) : undefined,
      },
    });
  }
}
