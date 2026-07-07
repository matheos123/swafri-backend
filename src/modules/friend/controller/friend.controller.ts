import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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

  @Post('request')
  sendRequest(@CurrentUser('sub') userId: string, @Body() dto: SendFriendRequestDto) {
    return this.friendService.sendRequest(userId, dto.addresseeId);
  }

  @Patch('respond')
  respond(@CurrentUser('sub') userId: string, @Body() dto: RespondFriendRequestDto) {
    return this.friendService.respond(userId, dto.friendshipId, dto.action);
  }

  @Get()
  getFriends(@CurrentUser('sub') userId: string) { return this.friendService.getFriends(userId); }

  @Get('requests')
  getRequests(@CurrentUser('sub') userId: string) { return this.friendService.getPendingRequests(userId); }

  @Delete(':friendId')
  remove(@CurrentUser('sub') userId: string, @Param('friendId') friendId: string) {
    return this.friendService.removeFriend(userId, friendId);
  }
}
