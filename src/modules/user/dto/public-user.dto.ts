import { ApiProperty } from '@nestjs/swagger';

/**
 * PublicUserDto
 *
 * Slim response shape for the public GET /users/:id endpoint.
 * Intentionally excludes: email, role, isActive, walletAddress —
 * none of which should be visible to unauthenticated callers.
 */
export class PublicUserDto {
  @ApiProperty() id!: string;
  @ApiProperty() username!: string;
  @ApiProperty({ required: false }) avatar?: string;
  @ApiProperty() wins!: number;
  @ApiProperty() losses!: number;
  @ApiProperty() totalMatches!: number;
  @ApiProperty() currentStreak!: number;
  @ApiProperty() longestStreak!: number;
  @ApiProperty() points!: number;
  @ApiProperty() createdAt!: Date;
}
