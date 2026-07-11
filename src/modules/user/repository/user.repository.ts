import { Injectable } from '@nestjs/common';
import { Prisma, Role, User } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

// ─── Filter / Pagination Types ────────────────────────────────────────────────

/**
 * Filters accepted by findAll.
 * All fields are optional — omitting them returns all matching rows.
 */
export interface UserFilters {
  role?:       Role;
  isActive?:   boolean;
  /** When true, include soft-deleted users. Default: false (exclude deleted) */
  includeDeleted?: boolean;
  /** Free-text search on username or email (case-insensitive contains) */
  search?:     string;
}

/** Pagination parameters passed to findAll */
export interface UserPagination {
  limit:  number;
  offset: number;
}

/** Shape returned by the paginated findAll */
export interface PaginatedUsers {
  data:  User[];
  total: number;
}

// ─── Repository ───────────────────────────────────────────────────────────────

/**
 * UserRepository
 *
 * Data access layer for all user-related operations.
 *
 * Soft-delete convention:
 *  - Soft-deleted users have deletedAt set to a timestamp
 *  - All read queries default to WHERE deletedAt IS NULL
 *  - Pass includeDeleted: true to include them (admin-only)
 *  - Hard deletes are intentionally removed; use softDelete() instead
 */
@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  // ─── Read (single) ────────────────────────────────────────────────────────

  /**
   * Find a user by ID.
   * Excludes soft-deleted users by default.
   */
  findById(id: string, includeDeleted = false): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        id,
        ...(!includeDeleted && { deletedAt: null }),
      },
    });
  }

  /**
   * Find a user by email.
   * Excludes soft-deleted users — deleted accounts cannot log in.
   */
  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
  }

  /**
   * Find a user by username.
   * Excludes soft-deleted users — their username stays reserved.
   */
  findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { username, deletedAt: null },
    });
  }

  /**
   * Find a user by wallet address.
   * Excludes soft-deleted users.
   */
  findByWalletAddress(walletAddress: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { 
        walletAddress: { equals: walletAddress, mode: 'insensitive' }, 
        deletedAt: null 
      },
    });
  }

  // ─── Read (paginated list) ────────────────────────────────────────────────

  /**
   * Return a paginated, filterable list of users.
   *
   * Filters:
   *  - role           — exact match (USER | ADMIN)
   *  - isActive       — exact match (true | false)
   *  - includeDeleted — when true, also return soft-deleted accounts
   *  - search         — case-insensitive contains on username OR email
   *
   * Pagination:
   *  - limit  / offset derived from PaginationDto
   *
   * Returns both the current page of data and the total count for the
   * calling service to build a PaginatedResponseDto.
   */
  async findAll(
    filters:    UserFilters    = {},
    pagination: UserPagination = { limit: 20, offset: 0 },
  ): Promise<PaginatedUsers> {
    const where: Prisma.UserWhereInput = {
      // Soft-delete filter
      ...(!filters.includeDeleted && { deletedAt: null }),

      // Role filter
      ...(filters.role !== undefined && { role: filters.role }),

      // isActive filter
      ...(filters.isActive !== undefined && { isActive: filters.isActive }),

      // Free-text search across username and email
      ...(filters.search && {
        OR: [
          { username: { contains: filters.search, mode: 'insensitive' } },
          { email:    { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
    };

    // Run count and data fetch in a single transaction round-trip
    const [total, data] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take:    pagination.limit,
        skip:    pagination.offset,
      }),
    ]);

    return { data, total };
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  updateRole(id: string, role: Role): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: { role } });
  }

  setActiveStatus(id: string, isActive: boolean): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: { isActive } });
  }

  // ─── Soft Delete & Restore ────────────────────────────────────────────────

  /**
   * Soft-delete a user by setting deletedAt to now.
   * The record stays in the database; all relations are preserved.
   */
  softDelete(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data:  { deletedAt: new Date() },
    });
  }

  /**
   * Restore a soft-deleted user by clearing deletedAt.
   */
  restore(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data:  { deletedAt: null },
    });
  }
}
