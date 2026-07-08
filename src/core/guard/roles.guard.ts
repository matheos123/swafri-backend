import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorator/roles.decorator';

/**
 * RolesGuard
 *
 * Must be used AFTER JwtAuthGuard so that req.user is already populated
 * with { userId, email, role }.
 *
 * Flow:
 *  1. Read the required roles from the @Roles() decorator metadata
 *  2. If no roles are required, allow the request through
 *  3. Compare req.user.role against the required roles
 *  4. Throw ForbiddenException if the user's role is not in the list
 *
 * @example
 * // Apply both guards on a single route
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles(Role.ADMIN)
 * @Delete(':id')
 * deleteUser() {}
 *
 * @example
 * // Apply at controller level so every route in the class is admin-only
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles(Role.ADMIN)
 * @Controller('admin')
 * export class AdminController {}
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Read roles required by the handler or its class
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(), // method-level decorator takes priority
      context.getClass(),   // fallback to class-level decorator
    ]);

    // No @Roles() decorator — allow any authenticated user through
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    // JwtAuthGuard should always run first; this is a safety check
    if (!user?.role) {
      throw new ForbiddenException('Access denied');
    }

    // Check if the user has one of the required roles
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Access denied — requires one of: [${requiredRoles.join(', ')}]`,
      );
    }

    return true;
  }
}
