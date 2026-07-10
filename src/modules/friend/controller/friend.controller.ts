import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FriendService } from '../service/friend.service';
import { SendFriendRequestDto, RespondFriendRequestDto } from '../dto/friend.dto';
import { CurrentUser } from '../../../core/decorator/index';
import { JwtAuthGuard } from '../../../core/guard/jwt-auth.guard';

@ApiTags('Friends')
@Controller('friends')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class FriendController {
  constructor(private readonly friendService: FriendService) {}

  // ─── Friend Requests ──────────────────────────────────────────────────────

  @Post('request')
  @ApiOperation({ summary: 'Send a friend request' })
  sendRequest(
    @CurrentUser('userId') userId: string,
    @Body() dto: SendFriendRequestDto,
  ) {
    return this.friendService.sendRequest(userId, dto.addresseeId);
  }

  @Patch('respond')
  @ApiOperation({ summary: 'Accept or block a friend request' })
  respond(
    @CurrentUser('userId') userId: string,
    @Body() dto: RespondFriendRequestDto,
  ) {
    return this.friendService.respond(userId, dto.friendshipId, dto.action);
  }

  @Get()
  @ApiOperation({ summary: 'List all accepted friends with online status' })
  getFriends(@CurrentUser('userId') userId: string) {
    return this.friendService.getFriends(userId);
  }

  @Get('requests')
  @ApiOperation({ summary: 'List pending incoming friend requests' })
  getRequests(@CurrentUser('userId') userId: string) {
    return this.friendService.getPendingRequests(userId);
  }

  @Delete(':friendId')
  @ApiOperation({ summary: 'Remove a friend' })
  remove(
    @CurrentUser('userId') userId: string,
    @Param('friendId') friendId: string,
  ) {
    return this.friendService.removeFriend(userId, friendId);
  }

  // ─── Game Invite ──────────────────────────────────────────────────────────

  /**
   * POST /friends/:friendId/invite
   * Invite a friend to a game. Friend must be online.
   * Sends a real-time notification to the friend via socket.
   * Friend receives: notification:live { type: 'game_invite', ... }
   * Friend can then emit matchmaking:join to enter the queue.
   */
  @Post(':friendId/invite')
  @ApiOperation({ summary: 'Invite a friend to a game' })
  async invite(
    @CurrentUser('userId') userId: string,
    @Param('friendId') friendId: string,
  ) {
    return this.friendService.inviteToGame(userId, friendId);
  }
}
