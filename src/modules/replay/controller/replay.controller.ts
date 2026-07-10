import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ReplayService } from '../service/replay.service';
import { JwtAuthGuard } from '../../../core/guard/jwt-auth.guard';
import { CurrentUser } from '../../../core/decorator/current-user.decorator';

@ApiTags('Replay')
@Controller('replay')
export class ReplayController {
  constructor(private readonly replayService: ReplayService) {}

  /**
   * GET /replay/history/me
   * Authenticated — current user's ranked match history.
   */
  @Get('history/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get your ranked match history' })
  @ApiQuery({ name: 'limit',  required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  getMyHistory(
    @CurrentUser('userId') userId: string,
    @Query('limit')  limit  = 20,
    @Query('offset') offset = 0,
  ) {
    return this.replayService.getMatchHistory(userId, +limit, +offset);
  }

  /**
   * GET /replay/history/:userId
   * Public — any player's ranked match history.
   */
  @Get('history/:userId')
  @ApiOperation({ summary: "Get a player's ranked match history" })
  @ApiQuery({ name: 'limit',  required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  getHistory(
    @Param('userId') userId: string,
    @Query('limit')  limit  = 20,
    @Query('offset') offset = 0,
  ) {
    return this.replayService.getMatchHistory(userId, +limit, +offset);
  }

  /**
   * GET /replay/:matchId
   * Public — full round-by-round replay for any match.
   */
  @Get(':matchId')
  @ApiOperation({ summary: 'Get full match replay by match ID' })
  getReplay(@Param('matchId') matchId: string) {
    return this.replayService.getMatchReplay(matchId);
  }
}
