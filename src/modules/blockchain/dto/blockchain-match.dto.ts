import { ApiProperty } from '@nestjs/swagger';

export class BlockchainMatchDto {
  @ApiProperty({ example: '101' })
  matchId!: string;

  @ApiProperty({ example: '0x1Be31A94361a391bBaFB2a4CCd704F57dc04d4bb' })
  winner!: string;

  @ApiProperty({ example: '1700000000' })
  timestamp!: string;

  @ApiProperty({ example: 'rps' })
  gameType!: string;

  @ApiProperty({ example: '0xabc...' })
  resultHash!: string;

  @ApiProperty({ example: '10' })
  pointsAwarded!: string;

  @ApiProperty({ example: 1 })
  badgeEarned!: number;
}
