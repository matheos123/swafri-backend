import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../../core/guard/jwt-auth.guard';
import { RolesGuard } from '../../../core/guard/roles.guard';
import { CurrentUser } from '../../../core/decorator/current-user.decorator';
import { Roles } from '../../../core/decorator/roles.decorator';
import { PaginationDto } from '../../../core/dto/pagination.dto';
import { UserService } from '../service/user.service';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { UserResponseDto } from '../dto/user-response.dto';
import { PublicUserDto } from '../dto/public-user.dto';

/**
 * UserController
 *
 * Access tiers:
 *
 * Public (no auth):
 *   GET  /users/:id                — slim public profile
 *
 * Authenticated (any active user):
 *   PATCH /users/me                — update own profile
 *
 * Admin only:
 *   GET    /users                  — paginated list with filters
 *   PATCH  /users/:id/role         — promote / demote
 *   PATCH  /users/:id/activate     — re-enable account
 *   PATCH  /users/:id/deactivate   — disable account
 *   DELETE /users/:id              — soft delete
 *   POST   /users/:id/restore      — restore a soft-deleted user
 */
@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // ─── Public ───────────────────────────────────────────────────────────────

  /**
   * GET /users/public
   * Paginated list of all active users (public profiles).
   */
  @Get('public')
  @ApiOperation({ summary: 'Get a paginated list of public user profiles' })
  @ApiOkResponse({ type: PublicUserDto, isArray: true })
  @ApiQuery({ name: 'page',  type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiQuery({ name: 'search', type: String, required: false })
  findAllPublic(
    @Query() pagination: PaginationDto,
    @Query('search') search?: string,
  ) {
    return this.userService.findAllPublic(pagination, search);
  }

  /**
   * GET /users/:id
   * Public profile — no auth required.
   * Soft-deleted users return 404.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a public user profile by ID' })
  @ApiOkResponse({ type: PublicUserDto })
  findById(@Param('id') id: string) {
    return this.userService.findPublicById(id);
  }

  // ─── Authenticated ────────────────────────────────────────────────────────

  /**
   * PATCH /users/me
   * Update the calling user's own profile (email, username, avatar).
   * User ID is taken from the JWT — cannot update another user.
   */
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @Patch('me')
  @ApiOperation({ summary: 'Update own profile' })
  @ApiOkResponse({ type: UserResponseDto })
  updateMe(@CurrentUser('userId') userId: string, @Body() dto: UpdateUserDto) {
    return this.userService.update(userId, dto);
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  /**
   * GET /users
   * Paginated, filterable user list.
   *
   * Query params:
   *   page            — page number (default: 1)
   *   limit           — items per page (default: 20, max: 100)
   *   role            — filter by role (USER | ADMIN)
   *   isActive        — filter by active status (true | false)
   *   includeDeleted  — include soft-deleted accounts (true | false, default: false)
   *   search          — case-insensitive search on username or email
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT')
  @Get()
  @ApiOperation({ summary: '[Admin] List users with pagination and filters' })
  @ApiQuery({ name: 'page',           type: Number,  required: false })
  @ApiQuery({ name: 'limit',          type: Number,  required: false })
  @ApiQuery({ name: 'role',           enum: Role,    required: false })
  @ApiQuery({ name: 'isActive',       type: Boolean, required: false })
  @ApiQuery({ name: 'includeDeleted', type: Boolean, required: false })
  @ApiQuery({ name: 'search',         type: String,  required: false })
  findAll(
    @Query() pagination: PaginationDto,
    @Query('role')           role?:           Role,
    @Query('isActive')       isActive?:       string,
    @Query('includeDeleted') includeDeleted?: string,
    @Query('search')         search?:         string,
  ) {
    return this.userService.findAll(
      {
        role,
        isActive:       isActive       === 'true' ? true  : isActive       === 'false' ? false : undefined,
        includeDeleted: includeDeleted === 'true' ? true  : false,
        search:         search?.trim()  || undefined,
      },
      pagination,
    );
  }

  /**
   * PATCH /users/:id/role
   * Promote or demote a user's role.
   * Body: { role: "ADMIN" | "USER" }
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT')
  @Patch(':id/role')
  @ApiOperation({ summary: '[Admin] Update a user role' })
  @ApiOkResponse({ type: UserResponseDto })
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser('userId') requestingUserId: string,
  ) {
    return this.userService.updateRole(id, dto, requestingUserId);
  }

  /**
   * PATCH /users/:id/activate
   * Re-enable a previously deactivated account.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT')
  @Patch(':id/activate')
  @HttpCode(200)
  @ApiOperation({ summary: '[Admin] Activate a user account' })
  @ApiOkResponse({ type: UserResponseDto })
  activate(
    @Param('id') id: string,
    @CurrentUser('userId') requestingUserId: string,
  ) {
    return this.userService.activate(id, requestingUserId);
  }

  /**
   * PATCH /users/:id/deactivate
   * Disable a user account — 403 on their next request.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT')
  @Patch(':id/deactivate')
  @HttpCode(200)
  @ApiOperation({ summary: '[Admin] Deactivate a user account' })
  @ApiOkResponse({ type: UserResponseDto })
  deactivate(
    @Param('id') id: string,
    @CurrentUser('userId') requestingUserId: string,
  ) {
    return this.userService.deactivate(id, requestingUserId);
  }

  /**
   * DELETE /users/:id
   * Soft-delete a user (sets deletedAt).
   * Record is preserved in DB — use POST /users/:id/restore to undo.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT')
  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: '[Admin] Soft-delete a user' })
  softDelete(
    @Param('id') id: string,
    @CurrentUser('userId') requestingUserId: string,
  ) {
    return this.userService.softDelete(id, requestingUserId);
  }

  /**
   * POST /users/:id/restore
   * Restore a soft-deleted user — clears deletedAt.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth('JWT')
  @Post(':id/restore')
  @HttpCode(200)
  @ApiOperation({ summary: '[Admin] Restore a soft-deleted user' })
  @ApiOkResponse({ type: UserResponseDto })
  restore(@Param('id') id: string) {
    return this.userService.restore(id);
  }
}
