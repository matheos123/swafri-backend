import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { BlockchainService } from './blockchain.service';
import { BlockchainHealthDto } from './dto/blockchain-health.dto';
import { BlockchainMatchDto } from './dto/blockchain-match.dto';
import { BlockchainPlayerDto } from './dto/blockchain-player.dto';
import { parseMatchIdParam } from './utils/match-id.util';
import { assertWalletAddress } from './utils/address.util';

@ApiTags('Blockchain')
@Controller('blockchain')
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) {}

  @Get('health')
  @ApiOkResponse({ type: BlockchainHealthDto })
  getHealth() {
    return this.blockchainService.getHealth();
  }

  @Get('player/:wallet')
  @ApiOkResponse({ type: BlockchainPlayerDto })
  async getPlayer(@Param('wallet') wallet: string) {
    const address = assertWalletAddress(wallet);
    const [points, badges] = await Promise.all([
      this.blockchainService.getPlayerPoints(address),
      this.blockchainService.getPlayerBadges(address),
    ]);

    return { wallet: address, points, badges };
  }

  @Get('match/:id')
  @ApiOkResponse({ type: BlockchainMatchDto })
  async getMatch(@Param('id') id: string) {
    const match = await this.blockchainService.getMatch(parseMatchIdParam(id));

    return {
      matchId: match.matchId,
      winner: match.winner,
      timestamp: match.timestamp.toString(),
      gameType: match.gameType,
      resultHash: match.resultHash,
      pointsAwarded: match.pointsAwarded.toString(),
      badgeEarned: match.badgeEarned,
    };
  }
}
