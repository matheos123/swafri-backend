import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { ReplayService } from '../service/replay.service';

@ApiTags('Replay')
@Controller('replay')
export class ReplayController {
  constructor(private readonly replayService: ReplayService) {}

  @Get(':matchId')
  getReplay(@Param('matchId') matchId: string) { return this.replayService.getMatchReplay(matchId); }

  @Get('history/:userId')
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  getHistory(@Param('userId') userId: string, @Query('limit') limit = 20, @Query('offset') offset = 0) {
    return this.replayService.getMatchHistory(userId, +limit, +offset);
  }
}
