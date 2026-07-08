import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

/** Metadata key used by RolesGuard to read required roles */
export const ROLES_KEY = 'roles';

/**
 * Roles decorator
 *
 * Attach to a controller class or individual route handler to restrict
 * access to users with one of the specified roles.
 *
 * @example
 * // Admin-only endpoint
 * @Roles(Role.ADMIN)
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Delete(':id')
 * deleteUser() {}
 *
 * @example
 * // Multiple roles allowed
 * @Roles(Role.ADMIN, Role.USER)
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
