import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Generic Room Chat (Quick Matches, Lobby) ─────────────────────────────

  saveMessage(roomId: string, userId: string, username: string, content: string) {
    return this.prisma.chatMessage.create({ data: { roomId, userId, username, content } });
  }

  getRoomHistory(roomId: string, limit = 50) {
    return this.prisma.chatMessage.findMany({ 
      where: { roomId, squadId: null }, // Only non-squad messages
      orderBy: { createdAt: 'asc' }, 
      take: limit 
    });
  }

  // ─── Squad Chat (Squad Members Only) ──────────────────────────────────────

  /**
   * Save a message to a squad chat room.
   * Only squad members can send messages.
   */
  async saveSquadMessage(
    squadId: string,
    userId: string,
    username: string,
    content: string,
  ) {
    // Verify user is a squad member
    const isMember = await this.isSquadMember(squadId, userId);
    if (!isMember) {
      throw new ForbiddenException('You must be a squad member to send messages in this squad');
    }

    return this.prisma.chatMessage.create({
      data: {
        roomId: `squad:${squadId}`, // Squad-specific room ID
        squadId,
        userId,
        username,
        content,
      },
    });
  }

  /**
   * Get squad chat history.
   * Only squad members can view squad chat.
   */
  async getSquadChatHistory(squadId: string, userId: string, limit = 100) {
    // Verify user is a squad member
    const isMember = await this.isSquadMember(squadId, userId);
    if (!isMember) {
      throw new ForbiddenException('You must be a squad member to view squad chat');
    }

    return this.prisma.chatMessage.findMany({
      where: { squadId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  /**
   * Check if user is a member of a squad.
   */
  private async isSquadMember(squadId: string, userId: string): Promise<boolean> {
    const member = await this.prisma.squadMember.findUnique({
      where: {
        squadId_userId: {
          squadId,
          userId,
        },
      },
    });

    return !!member;
  }
}
