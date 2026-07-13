import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateSquadDto, UpdateSquadDto, InviteToSquadDto, RespondToSquadInviteDto } from '../dto/squad.dto';

@Injectable()
export class SquadService {
  private readonly logger = new Logger(SquadService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Squad CRUD ───────────────────────────────────────────────────────────

  /**
   * Create a new squad. The creator becomes the owner.
   */
  async createSquad(userId: string, dto: CreateSquadDto) {
    const squad = await this.prisma.squad.create({
      data: {
        name: dto.name,
        description: dto.description,
        ownerId: userId,
        members: {
          create: {
            userId,
            role: 'OWNER',
          },
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    this.logger.log(`Squad created: ${squad.name} by ${userId}`);
    return squad;
  }

  /**
   * Get all squads the user is a member of.
   */
  async getUserSquads(userId: string) {
    const memberships = await this.prisma.squadMember.findMany({
      where: { userId },
      include: {
        squad: {
          include: {
            owner: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    avatar: true,
                  },
                },
              },
            },
            _count: {
              select: {
                members: true,
              },
            },
          },
        },
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });

    return memberships.map((m) => ({
      ...m.squad,
      userRole: m.role,
      memberCount: m.squad._count.members,
    }));
  }

  /**
   * Get squad by ID with full details.
   */
  async getSquadById(squadId: string, userId?: string) {
    const squad = await this.prisma.squad.findUnique({
      where: { id: squadId },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
                walletAddress: true,
              },
            },
          },
          orderBy: {
            joinedAt: 'asc',
          },
        },
        _count: {
          select: {
            members: true,
            messages: true,
          },
        },
      },
    });

    if (!squad) {
      throw new NotFoundException('Squad not found');
    }

    // If userId provided, check if user is a member and get their role
    let userRole: string | null = null;
    let isMember = false;
    if (userId) {
      const membership = squad.members.find((m) => m.userId === userId);
      if (membership) {
        userRole = membership.role;
        isMember = true;
      }
    }

    return {
      ...squad,
      userRole,
      isMember,
      memberCount: squad._count.members,
      messageCount: squad._count.messages,
    };
  }

  /**
   * Update squad details. Only owner or admins can update.
   */
  async updateSquad(squadId: string, userId: string, dto: UpdateSquadDto) {
    await this.checkMemberRole(squadId, userId, ['OWNER', 'ADMIN']);

    const squad = await this.prisma.squad.update({
      where: { id: squadId },
      data: dto,
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    this.logger.log(`Squad updated: ${squadId} by ${userId}`);
    return squad;
  }

  /**
   * Delete squad. Only owner can delete.
   */
  async deleteSquad(squadId: string, userId: string) {
    const squad = await this.prisma.squad.findUnique({
      where: { id: squadId },
      select: { ownerId: true },
    });

    if (!squad) {
      throw new NotFoundException('Squad not found');
    }

    if (squad.ownerId !== userId) {
      throw new ForbiddenException('Only the squad owner can delete the squad');
    }

    await this.prisma.squad.delete({
      where: { id: squadId },
    });

    this.logger.log(`Squad deleted: ${squadId} by ${userId}`);
    return { message: 'Squad deleted successfully' };
  }

  // ─── Member Management ────────────────────────────────────────────────────

  /**
   * Invite a friend to the squad. Only members can invite, and invitee must be a friend.
   */
  async inviteToSquad(squadId: string, inviterId: string, dto: InviteToSquadDto) {
    // Check if inviter is a member
    await this.checkIsMember(squadId, inviterId);

    // Check if invitee exists
    const invitee = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, username: true },
    });

    if (!invitee) {
      throw new NotFoundException('User not found');
    }

    // Check if they are friends
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: inviterId, addresseeId: dto.userId, status: 'ACCEPTED' },
          { requesterId: dto.userId, addresseeId: inviterId, status: 'ACCEPTED' },
        ],
      },
    });

    if (!friendship) {
      throw new BadRequestException('You can only invite friends to your squad');
    }

    // Check if already a member
    const existingMember = await this.prisma.squadMember.findUnique({
      where: {
        squadId_userId: {
          squadId,
          userId: dto.userId,
        },
      },
    });

    if (existingMember) {
      throw new BadRequestException('User is already a member of this squad');
    }

    // Check if already invited
    const existingInvite = await this.prisma.squadInvite.findUnique({
      where: {
        squadId_inviteeId: {
          squadId,
          inviteeId: dto.userId,
        },
      },
    });

    if (existingInvite && existingInvite.status === 'PENDING') {
      throw new BadRequestException('User has already been invited to this squad');
    }

    // Create invite
    const invite = await this.prisma.squadInvite.create({
      data: {
        squadId,
        inviterId,
        inviteeId: dto.userId,
        status: 'PENDING',
      },
      include: {
        squad: {
          select: {
            id: true,
            name: true,
          },
        },
        inviter: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    // Create notification for invitee
    await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: 'SQUAD_INVITE',
        message: `${invite.inviter.username} invited you to join "${invite.squad.name}"`,
        data: {
          squadId,
          squadName: invite.squad.name,
          inviterId,
          inviterUsername: invite.inviter.username,
          inviteId: invite.id,
        },
      },
    });

    this.logger.log(`Squad invite sent: ${inviterId} invited ${dto.userId} to ${squadId}`);
    return invite;
  }

  /**
   * Respond to a squad invite (accept or decline).
   */
  async respondToInvite(inviteId: string, userId: string, dto: RespondToSquadInviteDto) {
    const invite = await this.prisma.squadInvite.findUnique({
      where: { id: inviteId },
      include: {
        squad: {
          select: {
            id: true,
            name: true,
          },
        },
        inviter: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (invite.inviteeId !== userId) {
      throw new ForbiddenException('This invite is not for you');
    }

    if (invite.status !== 'PENDING') {
      throw new BadRequestException('This invite has already been responded to');
    }

    // Update invite status
    await this.prisma.squadInvite.update({
      where: { id: inviteId },
      data: { status: dto.action },
    });

    if (dto.action === 'ACCEPTED') {
      // Add user to squad as member
      await this.prisma.squadMember.create({
        data: {
          squadId: invite.squadId,
          userId,
          role: 'MEMBER',
        },
      });

      // Notify inviter
      await this.prisma.notification.create({
        data: {
          userId: invite.inviterId,
          type: 'SQUAD_INVITE_ACCEPTED',
          message: `Your squad invite to "${invite.squad.name}" was accepted`,
          data: {
            squadId: invite.squadId,
            squadName: invite.squad.name,
            acceptedBy: userId,
          },
        },
      });

      this.logger.log(`Squad invite accepted: ${userId} joined ${invite.squadId}`);
      return { message: 'Squad invite accepted. You are now a member!', squad: invite.squad };
    } else {
      this.logger.log(`Squad invite declined: ${userId} declined ${invite.squadId}`);
      return { message: 'Squad invite declined' };
    }
  }

  /**
   * Leave a squad.
   */
  async leaveSquad(squadId: string, userId: string) {
    const squad = await this.prisma.squad.findUnique({
      where: { id: squadId },
      select: { ownerId: true, name: true },
    });

    if (!squad) {
      throw new NotFoundException('Squad not found');
    }

    if (squad.ownerId === userId) {
      throw new BadRequestException('Squad owner cannot leave. Transfer ownership or delete the squad.');
    }

    const member = await this.prisma.squadMember.findUnique({
      where: {
        squadId_userId: {
          squadId,
          userId,
        },
      },
    });

    if (!member) {
      throw new NotFoundException('You are not a member of this squad');
    }

    await this.prisma.squadMember.delete({
      where: {
        squadId_userId: {
          squadId,
          userId,
        },
      },
    });

    this.logger.log(`User left squad: ${userId} left ${squadId}`);
    return { message: 'You have left the squad' };
  }

  /**
   * Kick a member from the squad. Only owner or admins can kick.
   */
  async kickMember(squadId: string, kickerId: string, targetUserId: string) {
    await this.checkMemberRole(squadId, kickerId, ['OWNER', 'ADMIN']);

    const squad = await this.prisma.squad.findUnique({
      where: { id: squadId },
      select: { ownerId: true },
    });

    if (!squad) {
      throw new NotFoundException('Squad not found');
    }

    if (squad.ownerId === targetUserId) {
      throw new BadRequestException('Cannot kick the squad owner');
    }

    const targetMember = await this.prisma.squadMember.findUnique({
      where: {
        squadId_userId: {
          squadId,
          userId: targetUserId,
        },
      },
    });

    if (!targetMember) {
      throw new NotFoundException('User is not a member of this squad');
    }

    await this.prisma.squadMember.delete({
      where: {
        squadId_userId: {
          squadId,
          userId: targetUserId,
        },
      },
    });

    // Notify kicked user
    await this.prisma.notification.create({
      data: {
        userId: targetUserId,
        type: 'SQUAD_MEMBER_LEFT',
        message: 'You have been removed from a squad',
        data: {
          squadId,
          kickedBy: kickerId,
        },
      },
    });

    this.logger.log(`Member kicked: ${kickerId} kicked ${targetUserId} from ${squadId}`);
    return { message: 'Member removed from squad' };
  }

  /**
   * Promote/demote a member (change role). Only owner can promote.
   */
  async changeMemberRole(squadId: string, ownerId: string, targetUserId: string, newRole: 'ADMIN' | 'MEMBER') {
    const squad = await this.prisma.squad.findUnique({
      where: { id: squadId },
      select: { ownerId: true },
    });

    if (!squad) {
      throw new NotFoundException('Squad not found');
    }

    if (squad.ownerId !== ownerId) {
      throw new ForbiddenException('Only the squad owner can change member roles');
    }

    if (squad.ownerId === targetUserId) {
      throw new BadRequestException('Cannot change the owner\'s role');
    }

    const member = await this.prisma.squadMember.findUnique({
      where: {
        squadId_userId: {
          squadId,
          userId: targetUserId,
        },
      },
    });

    if (!member) {
      throw new NotFoundException('User is not a member of this squad');
    }

    await this.prisma.squadMember.update({
      where: {
        squadId_userId: {
          squadId,
          userId: targetUserId,
        },
      },
      data: { role: newRole },
    });

    this.logger.log(`Member role changed: ${targetUserId} is now ${newRole} in ${squadId}`);
    return { message: `Member role updated to ${newRole}` };
  }

  /**
   * Get pending invites for a user.
   */
  async getUserInvites(userId: string) {
    return this.prisma.squadInvite.findMany({
      where: {
        inviteeId: userId,
        status: 'PENDING',
      },
      include: {
        squad: {
          select: {
            id: true,
            name: true,
            description: true,
            _count: {
              select: {
                members: true,
              },
            },
          },
        },
        inviter: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get squad members list.
   */
  async getSquadMembers(squadId: string) {
    const squad = await this.prisma.squad.findUnique({
      where: { id: squadId },
    });

    if (!squad) {
      throw new NotFoundException('Squad not found');
    }

    return this.prisma.squadMember.findMany({
      where: { squadId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
            walletAddress: true,
            wins: true,
            losses: true,
            points: true,
            currentStreak: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' }, // OWNER first, then ADMIN, then MEMBER
        { joinedAt: 'asc' },
      ],
    });
  }

  // ─── Helper Methods ───────────────────────────────────────────────────────

  async checkIsMember(squadId: string, userId: string): Promise<void> {
    const member = await this.prisma.squadMember.findUnique({
      where: {
        squadId_userId: {
          squadId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this squad');
    }
  }

  async checkMemberRole(squadId: string, userId: string, allowedRoles: string[]): Promise<void> {
    const member = await this.prisma.squadMember.findUnique({
      where: {
        squadId_userId: {
          squadId,
          userId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this squad');
    }

    if (!allowedRoles.includes(member.role)) {
      throw new ForbiddenException('You do not have permission to perform this action');
    }
  }

  async getMemberRole(squadId: string, userId: string): Promise<string | null> {
    const member = await this.prisma.squadMember.findUnique({
      where: {
        squadId_userId: {
          squadId,
          userId,
        },
      },
      select: { role: true },
    });

    return member?.role || null;
  }
}
