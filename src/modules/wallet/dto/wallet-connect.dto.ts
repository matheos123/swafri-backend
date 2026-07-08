import { ApiProperty } from '@nestjs/swagger';
import { IsEthereumAddress, IsString } from 'class-validator';

/** Body for POST /wallet/connect — requires address + signature proving ownership */
export class WalletConnectDto {
  @ApiProperty({ example: '0xabc123abc123abc123abc123abc123abc123abc1', description: 'Ethereum wallet address' })
  @IsEthereumAddress()
  walletAddress!: string;

  @ApiProperty({ example: '0xsignature...', description: 'Signature of the challenge message from MetaMask' })
  @IsString()
  signature!: string;
}
