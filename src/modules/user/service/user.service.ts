import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { UserRepository, UserFilters } from '../repository/user.repository';
import { RedisService } from '../../../core/redis/redis.service';
import { PaginationDto, PaginatedResponseDto } from '../../../core/dto/pagination.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { UserResponseDto } from '../dto/user-response.dto';
import { PublicUserDto } from '../dto/public-user.dto';

/**
 * UserService
 *
 * Business logic for all user operations:
 * - Public profile reads (slim DTO, no sensitive fields)
 * - Full profile reads for authenticated users / admin
 * - Paginated + filterable user list (admin)
 * - Self-service profile update
 * - Role management (admin)
 * - Account activation / deactivation (admin)
 * - Soft delete and restore (admin)
 */
@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly redisService:   RedisService,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /** Strip sensitive fields for authenticated / admin responses */
  private strip(user: any): UserResponseDto {
    const { password, refreshToken, ...rest } = user;
    return rest as UserResponseDto;
  }

  /** Strip to public-safe shape — no email, role, isActive, walletAddress */
  private stripPublic(user: any): PublicUserDto {
    return {
      id:            user.id,
      username:      user.username,
      avatar:        user.avatar,
      wins:          user.wins,
      losses:        user.losses,
      totalMatches:  user.totalMatches,
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      points:        user.points,
      createdAt:     user.createdAt,
    };
  }

  // ─── Public Reads ─────────────────────────────────────────────────────────

  /**
   * Public profile — slim DTO, no auth required.
   * Soft-deleted users return 404.
   */
  async findPublicById(id: string): Promise<PublicUserDto> {
    const user = await this.userRepository.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return this.stripPublic(user);
  }

  /**
   * Full profile — for the authenticated user viewing their own profile.
   * Soft-deleted users return 404.
   */
  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return this.strip(user);
  }

  // ─── Internal Lookups (used by AuthService) ───────────────────────────────

  /** Returns the raw User including sensitive fields — never returned to HTTP clients */
  findByEmail(email: string) {
    return this.userRepository.findByEmail(email);
  }

  findByUsername(username: string) {
    return this.userRepository.findByUsername(username);
  }

  // ─── Paginated List (admin) ───────────────────────────────────────────────

  /**
   * Paginated, filterable list of users — admin only.
   *
   * Filters (all optional):
   *  - role           — USER | ADMIN
   *  - isActive       — true | false
   *  - includeDeleted — include soft-deleted accounts (default: false)
   *  - search         — case-insensitive match on username or email
   *
   * @param filters    - Filter options
   * @param pagination - Page + limit from the request query
   */
  async findAll(
    filters:    UserFilters,
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
    const { data, total } = await this.userRepository.findAll(filters, {
      limit:  pagination.limit,
      offset: pagination.offset,
    });

    return PaginatedResponseDto.of(
      data.map((u) => this.strip(u)),
      total,
      pagination.page,
      pagination.limit,
    );
  }

  // ─── Create ───────────────────────────────────────────────────────────────

  /** Called by AuthService during registration — returns raw User */
  create(data: Prisma.UserCreateInput) {
    return this.userRepository.create(data);
  }

  // ─── Self-Service Update ──────────────────────────────────────────────────

  /**
   * Update the calling user's own profile fields.
   * Validates uniqueness of email / username before writing.
   */
  async update(id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    const existing = await this.userRepository.findById(id);
    if (!existing) throw new NotFoundException('User not found');

    if (dto.email && dto.email !== existing.email) {
      const taken = await this.userRepository.findByEmail(dto.email);
      if (taken) throw new ConflictException('Email already in use');
    }

    if (dto.username && dto.username !== existing.username) {
      const taken = await this.userRepository.findByUsername(dto.username);
      if (taken) throw new ConflictException('Username already in use');
    }

    const user = await this.userRepository.update(id, dto as Prisma.UserUpdateInput);
    return this.strip(user);
  }

  // ─── Admin: Role Management ───────────────────────────────────────────────

  /** Admins cannot change their own role */
  async updateRole(id: string, dto: UpdateRoleDto, requestingUserId: string): Promise<UserResponseDto> {
    if (id === requestingUserId) {
      throw new ForbiddenException('You cannot change your own role');
    }
    const existing = await this.userRepository.findById(id, true); // include deleted for visibility
    if (!existing) throw new NotFoundException('User not found');

    const user = await this.userRepository.updateRole(id, dto.role);
    return this.strip(user);
  }

  // ─── Admin: Account Activation ────────────────────────────────────────────

  /** Admins cannot activate/deactivate themselves */
  async activate(id: string, requestingUserId: string): Promise<UserResponseDto> {
    if (id === requestingUserId) {
      throw new ForbiddenException('You cannot activate your own account');
    }
    const existing = await this.userRepository.findById(id, true);
    if (!existing) throw new NotFoundException('User not found');
    if (existing.isActive) throw new BadRequestException('Account is already active');

    const user = await this.userRepository.setActiveStatus(id, true);
    await this.redisService.invalidateActiveStatus(id);
    return this.strip(user);
  }

  async deactivate(id: string, requestingUserId: string): Promise<UserResponseDto> {
    if (id === requestingUserId) {
      throw new ForbiddenException('You cannot deactivate your own account');
    }
    const existing = await this.userRepository.findById(id, true);
    if (!existing) throw new NotFoundException('User not found');
    if (!existing.isActive) throw new BadRequestException('Account is already inactive');

    const user = await this.userRepository.setActiveStatus(id, false);
    await this.redisService.invalidateActiveStatus(id);
    return this.strip(user);
  }

  // ─── Admin: Soft Delete & Restore ─────────────────────────────────────────

  /**
   * Soft-delete a user.
   *
   * Sets deletedAt to now — the record is preserved in the DB.
   * The user will get 404 on login and all public lookups.
   * Admins cannot delete themselves.
   */
  async softDelete(id: string, requestingUserId: string): Promise<{ message: string }> {
    if (id === requestingUserId) {
      throw new ForbiddenException('You cannot delete your own account');
    }
    const existing = await this.userRepository.findById(id, true);
    if (!existing) throw new NotFoundException('User not found');
    if (existing.deletedAt) throw new BadRequestException('User is already deleted');

    await this.userRepository.softDelete(id);

    // Invalidate active-status cache — deleted user should be blocked immediately
    await this.redisService.invalidateActiveStatus(id);

    return { message: 'User deleted successfully' };
  }

  /**
   * Restore a soft-deleted user.
   *
   * Clears deletedAt — the account becomes visible and usable again.
   * The user's isActive state is preserved from before the deletion.
   */
  async restore(id: string): Promise<UserResponseDto> {
    // Must explicitly include deleted records to find them
    const existing = await this.userRepository.findById(id, true);
    if (!existing) throw new NotFoundException('User not found');
    if (!existing.deletedAt) throw new BadRequestException('User is not deleted');

    const user = await this.userRepository.restore(id);

    // Re-cache the active status after restore
    await this.redisService.cacheActiveStatus(id, user.isActive);

    return this.strip(user);
  }
}
