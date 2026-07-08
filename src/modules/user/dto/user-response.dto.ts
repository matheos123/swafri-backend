import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() username!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ required: false }) avatar?: string;
  @ApiProperty({ required: false }) walletAddress?: string;
  @ApiProperty() wins!: number;
  @ApiProperty() losses!: number;
  @ApiProperty() totalMatches!: number;
  @ApiProperty() currentStreak!: number;
  @ApiProperty() longestStreak!: number;
  @ApiProperty({ description: 'Off-chain game points (always updated on win)' })
  points!: number;

  @ApiProperty({
    description: 'On-chain points mirrored after blockchain confirmation',
    example: 0,
  })
  onChainPoints!: number;

  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
