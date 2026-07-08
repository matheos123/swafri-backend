import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { WalletService } from '../service/wallet.service';
import { WalletConnectDto } from '../dto/wallet-connect.dto';
import { WalletResponseDto } from '../dto/wallet-response.dto';
import { JwtAuthGuard } from '../../../core/guard/jwt-auth.guard';

@ApiTags('Wallet')
@Controller('wallet')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post('connect')
  @ApiOperation({
    summary: 'Connect MetaMask wallet',
    description:
      'Links a wallet to the logged-in user after signature verification. ' +
      'Sign the exact message with MetaMask (ethers `signMessage`), then send address + message + signature. ' +
      'Recommended message: `Connect wallet to Web3 Battle Arena`.',
  })
  @ApiBody({ type: WalletConnectDto })
  @ApiOkResponse({ type: WalletResponseDto, description: 'Wallet linked' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  @ApiBadRequestResponse({
    description: 'Invalid signature, invalid address, or wallet already linked to another account',
  })
  connect(@Req() req: any, @Body() dto: WalletConnectDto) {
    return this.walletService.connect(
      req.user.userId,
      dto.walletAddress,
      dto.message,
      dto.signature,
    );
  }

  @Post('disconnect')
  @ApiOperation({
    summary: 'Disconnect wallet',
    description:
      'Removes `walletAddress` from the current user. Future wins will not write on-chain until reconnect.',
  })
  @ApiOkResponse({ type: WalletResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  disconnect(@Req() req: any) {
    return this.walletService.disconnect(req.user.userId);
  }

  @Get('status')
  @ApiOperation({
    summary: 'Wallet connection status',
    description: 'Returns whether the current user has a linked MetaMask address.',
  })
  @ApiOkResponse({ type: WalletResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  status(@Req() req: any) {
    return this.walletService.status(req.user.userId);
  }
}
