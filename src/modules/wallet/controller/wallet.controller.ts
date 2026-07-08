import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WalletService } from '../service/wallet.service';
import { WalletConnectDto } from '../dto/wallet-connect.dto';
import { WalletChallengeDto } from '../dto/wallet-challenge.dto';
import { WalletResponseDto } from '../dto/wallet-response.dto';
import { JwtAuthGuard } from '../../../core/guard/jwt-auth.guard';
import { CurrentUser } from '../../../core/decorator/current-user.decorator';

/**
 * WalletController
 *
 * Endpoints for linking/unlinking a wallet to an existing email account.
 *
 * Flow:
 *   1. GET  /wallet/challenge  → get a nonce message to sign in MetaMask
 *   2. POST /wallet/connect    → submit address + signature → wallet linked
 *   3. POST /wallet/disconnect → unlink wallet
 *   4. GET  /wallet/status     → check current wallet status
 */
@ApiTags('Wallet')
@Controller('wallet')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  // ─── Challenge ────────────────────────────────────────────────────────────

  /**
   * GET /wallet/challenge
   * Returns a human-readable message for the client to sign with MetaMask.
   * The nonce is stored in Redis (5 min TTL) tied to the authenticated user.
   */
  @Get('challenge')
  @ApiOperation({ summary: 'Get a wallet connection challenge message to sign' })
  challenge(@CurrentUser('userId') userId: string, @Body() dto: WalletChallengeDto) {
    return this.walletService.generateChallenge(userId, dto.address);
  }

  // ─── Connect ──────────────────────────────────────────────────────────────

  /**
   * POST /wallet/connect
   * Link a wallet to the authenticated user's account.
   * Requires { address, signature } — signature proves wallet ownership.
   */
  @Post('connect')
  @HttpCode(200)
  @ApiOperation({ summary: 'Connect a wallet with cryptographic proof of ownership' })
  @ApiOkResponse({ type: WalletResponseDto })
  connect(
    @CurrentUser('userId') userId: string,
    @Body() dto: WalletConnectDto,
  ) {
    return this.walletService.connect(userId, dto.walletAddress, dto.signature);
  }

  // ─── Disconnect ───────────────────────────────────────────────────────────

  /**
   * POST /wallet/disconnect
   * Unlink the wallet from the authenticated user's account.
   */
  @Post('disconnect')
  @HttpCode(200)
  @ApiOperation({ summary: 'Disconnect wallet from account' })
  disconnect(@CurrentUser('userId') userId: string) {
    return this.walletService.disconnect(userId);
  }

  // ─── Status ───────────────────────────────────────────────────────────────

  /**
   * GET /wallet/status
   * Returns current wallet connection status for the authenticated user.
   */
  @Get('status')
  @ApiOperation({ summary: 'Get wallet connection status' })
  @ApiOkResponse({ type: WalletResponseDto })
  status(@CurrentUser('userId') userId: string) {
    return this.walletService.status(userId);
  }
}
