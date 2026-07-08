import { ApiProperty } from '@nestjs/swagger';
import { IsEthereumAddress } from 'class-validator';

/** Body for GET /wallet/challenge — the address the user wants to link */
export class WalletChallengeDto {
  @ApiProperty({ example: '0xABC123...', description: 'Wallet address to generate a challenge for' })
  @IsEthereumAddress()
  address!: string;
}
