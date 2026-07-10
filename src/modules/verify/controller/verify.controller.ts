import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { VerifyService } from '../service/verify.service';

/**
 * VerifyController
 *
 * Public endpoints — no auth required.
 * These are the demo endpoints for judges and auditors.
 *
 * A judge can:
 *  - Take any matchId from the game and verify its result on-chain
 *  - Take any blockchainProfileId and resolve it to a player identity
 *  - Take any wallet address and resolve it to a player
 */
@ApiTags('Verify')
@Controller('verify')
export class VerifyController {
  constructor(private readonly verifyService: VerifyService) {}

  /**
   * GET /verify/match/:matchId
   *
   * Returns the full match result with:
   *  - Both players' wallet addresses and profile IDs
   *  - Winner
   *  - onChainHash — cryptographic proof of the result
   *  - Block explorer link to view the hash
   *  - Round-by-round breakdown
   *  - Instructions on how to independently verify
   */
  @Get('match/:matchId')
  @ApiOperation({
    summary: 'Verify a match result — returns on-chain hash and block explorer link',
    description: 'Public endpoint. Anyone can verify any match result cryptographically.',
  })
  verifyMatch(@Param('matchId') matchId: string) {
    return this.verifyService.verifyMatch(matchId);
  }

  /**
   * GET /verify/player/:profileId
   *
   * Resolves a blockchainProfileId to a full player identity card:
   *  - Wallet address with block explorer link
   *  - Win/loss stats
   *  - Achievement badges earned
   *  - On-chain verification timestamp
   */
  @Get('player/:profileId')
  @ApiOperation({
    summary: 'Verify a player identity by blockchain profile ID',
    description: 'Public endpoint. Resolves a keccak256 profile ID to a player.',
  })
  verifyPlayer(@Param('profileId') profileId: string) {
    return this.verifyService.verifyPlayer(profileId);
  }

  /**
   * GET /verify/wallet/:walletAddress
   *
   * Alternative to verifyPlayer — resolves by wallet address instead of profileId.
   * Useful for looking up a player when you know their wallet but not their profileId.
   */
  @Get('wallet/:walletAddress')
  @ApiOperation({
    summary: 'Verify a player identity by wallet address',
    description: 'Public endpoint. Resolves a wallet address to a player identity.',
  })
  verifyWallet(@Param('walletAddress') walletAddress: string) {
    return this.verifyService.verifyWallet(walletAddress);
  }
}
