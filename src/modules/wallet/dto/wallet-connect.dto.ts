import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class WalletConnectDto {
  @ApiProperty({ example: '0xabc123abc123abc123abc123abc123abc123abc1' })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid Ethereum address' })
  walletAddress!: string;

  @ApiProperty({ example: 'Connect wallet to Web3 Battle Arena' })
  @IsString()
  @IsNotEmpty()
  message!: string;

  @ApiProperty({
    example: '0x8f2a5d1f3e9c4b7a6d2c1f8e5a9b3c4d7e1f0a2b8c6d4e3f1a9b7c5d3e2f1a6b1c',
  })
  @IsString()
  @IsNotEmpty()
  signature!: string;
}
