import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { GameService } from '../service/game.service';

@ApiTags('Game')
@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Get('rooms/count')
  @ApiOkResponse({ schema: { properties: { count: { type: 'number' } } } })
  getRoomCount() {
    return { count: this.gameService.getRoomCount() };
  }

  @Get('rooms/:roomId')
  getRoom(@Param('roomId') roomId: string) {
    const room = this.gameService.getRoom(roomId);
    return {
      roomId: room.roomId, status: room.status,
      currentRound: room.currentRound, player1Wins: room.player1Wins, player2Wins: room.player2Wins,
    };
  }
}
