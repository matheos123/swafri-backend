import { ApiProperty } from '@nestjs/swagger';

export class WalletResponseDto {
  @ApiProperty() connected!: boolean;
  @ApiProperty({ required: false }) walletAddress?: string;
}
