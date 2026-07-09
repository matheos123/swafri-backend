import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { LeaderboardService } from '../service/leaderboard.service';
import { JwtAuthGuard } from '../../../core/guard/jwt-auth.guard';
import { CurrentUser } from '../../../core/decorator/current-user.decorator';

@ApiTags('Leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  /**
   * GET /leaderboard
   * Public — returns top ranked players (wallet verified only).
   */
  @Get()
  @ApiOperation({ summary: 'Get the ranked leaderboard (wallet-verified players only)' })
  @ApiQuery({ name: 'limit',  required: false, type: Number, description: 'Max results (default 50)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Pagination offset' })
  getLeaderboard(
    @Query('limit')  limit  = 50,
    @Query('offset') offset = 0,
  ) {
    return this.leaderboardService.getLeaderboard(+limit, +offset);
  }

  /**
   * GET /leaderboard/me
   * Authenticated — returns the current user's rank.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get your current rank on the leaderboard' })
  getMyRank(@CurrentUser('userId') userId: string) {
    return this.leaderboardService.getPlayerRank(userId);
  }

  /**
   * GET /leaderboard/rank/:userId
   * Public — returns a specific player's rank.
   */
  @Get('rank/:userId')
  @ApiOperation({ summary: "Get a player's rank by user ID" })
  getPlayerRank(@Param('userId') userId: string) {
    return this.leaderboardService.getPlayerRank(userId);
  }
}
