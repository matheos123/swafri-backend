import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
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
  @ApiOkResponse({ type: WalletResponseDto })
  connect(@Req() req: any, @Body() dto: WalletConnectDto) {
    return this.walletService.connect(req.user.userId, dto.walletAddress);
  }

  @Post('disconnect')
  disconnect(@Req() req: any) {
    return this.walletService.disconnect(req.user.userId);
  }

  @Get('status')
  @ApiOkResponse({ type: WalletResponseDto })
  status(@Req() req: any) {
    return this.walletService.status(req.user.userId);
  }
}
