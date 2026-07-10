import { Controller, Get, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { NotificationService } from '../service/notification.service';
import { JwtAuthGuard } from '../../../core/guard/jwt-auth.guard';
import { CurrentUser } from '../../../core/decorator/current-user.decorator';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * GET /notifications
   * Returns all notifications for the current user.
   * Unread first, then read. Supports pagination.
   */
  @Get()
  @ApiOperation({ summary: 'Get all notifications for the current user' })
  @ApiQuery({ name: 'limit',  required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  getAll(
    @CurrentUser('userId') userId: string,
    @Query('limit')  limit  = 50,
    @Query('offset') offset = 0,
  ) {
    return this.notificationService.getForUser(userId, +limit, +offset);
  }

  /**
   * PATCH /notifications/:id/read
   * Mark a single notification as read.
   */
  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markRead(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.notificationService.markRead(id, userId);
  }

  /**
   * PATCH /notifications/read-all
   * Mark all notifications as read.
   */
  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@CurrentUser('userId') userId: string) {
    return this.notificationService.markAllRead(userId);
  }
}
