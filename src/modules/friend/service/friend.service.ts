import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class FriendService {
  constructor(private readonly prisma: PrismaService) {}

  async sendRequest(requesterId: string, addresseeId: string) {
    if (requesterId === addresseeId) throw new BadRequestException('Cannot send request to yourself');
    const existing = await this.prisma.friendship.findUnique({ where: { requesterId_addresseeId: { requesterId, addresseeId } } });
    if (existing) throw new ConflictException('Friend request already exists');
    return this.prisma.friendship.create({ data: { requesterId, addresseeId } });
  }

  async respond(userId: string, friendshipId: string, action: 'ACCEPTED' | 'BLOCKED') {
    const f = await this.prisma.friendship.findUnique({ where: { id: friendshipId } });
    if (!f) throw new NotFoundException('Friend request not found');
    if (f.addresseeId !== userId) throw new BadRequestException('Not authorized');
    return this.prisma.friendship.update({ where: { id: friendshipId }, data: { status: action } });
  }

  async getFriends(userId: string) {
    const fs = await this.prisma.friendship.findMany({
      where: { OR: [{ requesterId: userId, status: 'ACCEPTED' }, { addresseeId: userId, status: 'ACCEPTED' }] },
      include: { requester: { select: { id: true, username: true, avatar: true } }, addressee: { select: { id: true, username: true, avatar: true } } },
    });
    return fs.map((f) => (f.requesterId === userId ? f.addressee : f.requester));
  }

  getPendingRequests(userId: string) {
    return this.prisma.friendship.findMany({ where: { addresseeId: userId, status: 'PENDING' }, include: { requester: { select: { id: true, username: true, avatar: true } } } });
  }

  async removeFriend(userId: string, friendId: string) {
    const f = await this.prisma.friendship.findFirst({ where: { OR: [{ requesterId: userId, addresseeId: friendId }, { requesterId: friendId, addresseeId: userId }], status: 'ACCEPTED' } });
    if (!f) throw new NotFoundException('Friendship not found');
    return this.prisma.friendship.delete({ where: { id: f.id } });
  }
}
