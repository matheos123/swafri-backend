import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationService } from '../../notification/service/notification.service';

/**
 * FriendService
 *
 * Handles all friendship operations:
 *  - Send / accept / block / remove friends
 *  - Game invites between friends
 *
 * Notifications are sent via NotificationService for real-time socket events.
 * The socket server reference is injected lazily — FriendService does not
 * need to know which socket connections are active; that is handled by
 * NotificationService which holds the Socket.IO server reference.
 *
 * Note: socket IDs are ephemeral (change on reconnect). For simplicity we
 * store the socketId in a Map when users connect to the matchmaking gateway.
 * The game invite flow looks up the online socketId from this map.
 */
@Injectable()
export class FriendService {
  // In-memory map of userId → socketId for online users
  // Updated by MatchmakingGateway and GameGateway on connect/disconnect
  private readonly onlineUsers = new Map<string, string>();

  constructor(
    private readonly prisma:           PrismaService,
    private readonly notificationSvc:  NotificationService,
  ) {}

  // ─── Online Tracking ──────────────────────────────────────────────────────

  setUserOnline(userId: string, socketId: string): void {
    this.onlineUsers.set(userId, socketId);
  }

  setUserOffline(userId: string): void {
    this.onlineUsers.delete(userId);
  }

  getSocketId(userId: string): string | undefined {
    return this.onlineUsers.get(userId);
  }

  // ─── Friend Request ───────────────────────────────────────────────────────

  async sendRequest(requesterId: string, addresseeId: string) {
    if (requesterId === addresseeId) {
      throw new BadRequestException('Cannot send a friend request to yourself');
    }

    const existing = await this.prisma.friendship.findUnique({
      where: { requesterId_addresseeId: { requesterId, addresseeId } },
    });
    if (existing) throw new ConflictException('Friend request already exists');

    const friendship = await this.prisma.friendship.create({
      data: { requesterId, addresseeId },
      include: { requester: { select: { id: true, username: true } } },
    });

    // Notify addressee — persist regardless of online status
    const addresseeSocket = this.onlineUsers.get(addresseeId);
    if (addresseeSocket) {
      await this.notificationSvc.sendToUser(
        addresseeSocket,
        'friend_request',
        `${friendship.requester.username} sent you a friend request`,
        { friendshipId: friendship.id, requesterId, username: friendship.requester.username },
        addresseeId,
      );
    } else {
      await this.notificationSvc.sendToUserById(
        addresseeId,
        'friend_request',
        `${friendship.requester.username} sent you a friend request`,
        { friendshipId: friendship.id, requesterId, username: friendship.requester.username },
      );
    }

    return friendship;
  }

  // ─── Respond to Request ───────────────────────────────────────────────────

  async respond(userId: string, friendshipId: string, action: 'ACCEPTED' | 'BLOCKED') {
    const f = await this.prisma.friendship.findUnique({
      where:   { id: friendshipId },
      include: { addressee: { select: { id: true, username: true } } },
    });
    if (!f) throw new NotFoundException('Friend request not found');
    if (f.addresseeId !== userId) throw new BadRequestException('Not authorized');

    const updated = await this.prisma.friendship.update({
      where: { id: friendshipId },
      data:  { status: action },
    });

    // Notify requester if accepted — persist regardless of online status
    if (action === 'ACCEPTED') {
      const requesterSocket = this.onlineUsers.get(f.requesterId);
      if (requesterSocket) {
        await this.notificationSvc.sendToUser(
          requesterSocket,
          'friend_accepted',
          `${f.addressee.username} accepted your friend request`,
          { friendshipId, addresseeId: userId, username: f.addressee.username },
          f.requesterId,
        );
      } else {
        await this.notificationSvc.sendToUserById(
          f.requesterId,
          'friend_accepted',
          `${f.addressee.username} accepted your friend request`,
          { friendshipId, addresseeId: userId, username: f.addressee.username },
        );
      }
    }

    return updated;
  }

  // ─── Get Friends ──────────────────────────────────────────────────────────

  async getFriends(userId: string) {
    const fs = await this.prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: userId, status: 'ACCEPTED' },
          { addresseeId: userId, status: 'ACCEPTED' },
        ],
      },
      include: {
        requester: { select: { id: true, username: true, avatar: true, walletAddress: true } },
        addressee: { select: { id: true, username: true, avatar: true, walletAddress: true } },
      },
    });

    return fs.map((f) => {
      const friend = f.requesterId === userId ? f.addressee : f.requester;
      return {
        ...friend,
        friendshipId: f.id,
        isOnline:     this.onlineUsers.has(friend.id),
      };
    });
  }

  // ─── Pending Requests ─────────────────────────────────────────────────────

  getPendingRequests(userId: string) {
    return this.prisma.friendship.findMany({
      where:   { addresseeId: userId, status: 'PENDING' },
      include: { requester: { select: { id: true, username: true, avatar: true } } },
    });
  }

  getOutgoingRequests(userId: string) {
    return this.prisma.friendship.findMany({
      where:   { requesterId: userId, status: 'PENDING' },
      include: { addressee: { select: { id: true, username: true, avatar: true } } },
    });
  }

  // ─── Remove Friend ────────────────────────────────────────────────────────

  async removeFriend(userId: string, friendId: string) {
    const f = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userId, addresseeId: friendId },
          { requesterId: friendId, addresseeId: userId },
        ],
        status: 'ACCEPTED',
      },
    });
    if (!f) throw new NotFoundException('Friendship not found');
    return this.prisma.friendship.delete({ where: { id: f.id } });
  }

  // ─── Game Invite ──────────────────────────────────────────────────────────

  /**
   * Invite a friend to a game.
   * Verifies they are friends before sending the invite.
   * Sends a real-time socket notification to the friend.
   *
   * @param fromUserId  - user sending the invite
   * @param toUserId    - friend to invite
   * @param fromUsername - display name of sender
   */
  async inviteToGame(fromUserId: string, toUserId: string) {
    // Look up sender username from DB
    const sender = await this.prisma.user.findUnique({
      where:  { id: fromUserId },
      select: { username: true },
    });
    const fromUsername = sender?.username ?? 'Someone';
    // Verify friendship exists
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: fromUserId, addresseeId: toUserId },
          { requesterId: toUserId,   addresseeId: fromUserId },
        ],
        status: 'ACCEPTED',
      },
    });

    if (!friendship) {
      throw new BadRequestException('You can only invite friends to a game');
    }

    // Check if friend is online
    const friendSocket = this.onlineUsers.get(toUserId);
    if (!friendSocket) {
      throw new BadRequestException('Your friend is not online right now');
    }

    // Send real-time game invite notification + persist
    await this.notificationSvc.sendToUser(
      friendSocket,
      'game_invite',
      `${fromUsername} invited you to a game!`,
      { fromUserId, fromUsername },
      toUserId,
    );

    return { invited: true, message: `Game invite sent to friend` };
  }
}
