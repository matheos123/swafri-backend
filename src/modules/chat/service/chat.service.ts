import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  saveMessage(roomId: string, userId: string, username: string, content: string) {
    return this.prisma.chatMessage.create({ data: { roomId, userId, username, content } });
  }

  getRoomHistory(roomId: string, limit = 50) {
    return this.prisma.chatMessage.findMany({ where: { roomId }, orderBy: { createdAt: 'asc' }, take: limit });
  }
}
