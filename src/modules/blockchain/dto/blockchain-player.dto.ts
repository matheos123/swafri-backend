import { ApiProperty } from '@nestjs/swagger';

export class BlockchainPlayerDto {
  @ApiProperty({ example: '0x1Be31A94361a391bBaFB2a4CCd704F57dc04d4bb' })
  wallet!: string;

  @ApiProperty({ example: '20' })
  points!: string;

  @ApiProperty({ example: [1, 2], type: [Number] })
  badges!: number[];
}
