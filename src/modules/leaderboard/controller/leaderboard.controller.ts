import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { LeaderboardService } from '../service/leaderboard.service';

@ApiTags('Leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  getLeaderboard(@Query('limit') limit = 50, @Query('offset') offset = 0) {
    return this.leaderboardService.getLeaderboard(+limit, +offset);
  }

  @Get('rank/:userId')
  getPlayerRank(@Param('userId') userId: string) {
    return this.leaderboardService.getPlayerRank(userId);
  }
}
