import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class WalletConnectDto {
  @ApiProperty({ example: '0xabc123abc123abc123abc123abc123abc123abc1' })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid Ethereum address' })
  walletAddress!: string;
}
