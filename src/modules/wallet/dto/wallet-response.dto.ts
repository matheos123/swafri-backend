import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WalletResponseDto {
  @ApiProperty({ example: true, description: 'Whether a wallet is linked to the user' })
  connected!: boolean;

  @ApiPropertyOptional({
    example: '0x1be31a94361a391bbafb2a4ccd704f57dc04d4bb',
    description: 'Linked wallet address (lowercase), or null/omitted when disconnected',
    nullable: true,
  })
  walletAddress?: string | null;
}
