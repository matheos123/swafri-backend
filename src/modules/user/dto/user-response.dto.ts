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
  @ApiProperty() points!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
