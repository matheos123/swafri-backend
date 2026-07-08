import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
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
  @ApiOperation({
    summary: 'Blockchain connection health',
    description:
      'Checks RPC connectivity, chain id (Polygon Amoy 80002), and whether GameReward is deployed at the configured address. No auth required.',
  })
  @ApiOkResponse({ type: BlockchainHealthDto })
  getHealth() {
    return this.blockchainService.getHealth();
  }

  @Get('player/:wallet')
  @ApiOperation({
    summary: 'On-chain player points and badges',
    description:
      'Reads cumulative points and owned badge IDs from the GameReward contract for a wallet address.',
  })
  @ApiParam({
    name: 'wallet',
    example: '0x1Be31A94361a391bBaFB2a4CCd704F57dc04d4bb',
    description: 'Ethereum wallet address (0x + 40 hex)',
  })
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
  @ApiOperation({
    summary: 'On-chain match record',
    description:
      'Reads a match from GameReward. Pass the backend match UUID or an on-chain numeric id. Returns 404 if never recorded on-chain.',
  })
  @ApiParam({
    name: 'id',
    description: 'Match UUID from the database or on-chain uint256 id',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiOkResponse({ type: BlockchainMatchDto })
  @ApiNotFoundResponse({ description: 'Match not found on-chain' })
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
