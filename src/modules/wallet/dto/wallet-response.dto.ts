import { ApiProperty } from '@nestjs/swagger';

export class WalletResponseDto {
  @ApiProperty({ description: 'Whether a wallet is connected and verified' })
  connected!: boolean;

  @ApiProperty({ required: false, description: 'Linked wallet address' })
  walletAddress?: string | null;

  @ApiProperty({ required: false, description: 'Timestamp of last successful signature verification' })
  walletVerifiedAt?: string | null;

  @ApiProperty({ required: false, description: 'On-chain blockchain profile ID (keccak256 hash)' })
  blockchainProfileId?: string | null;
}
