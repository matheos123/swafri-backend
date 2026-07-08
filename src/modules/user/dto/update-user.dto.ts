import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

/**
 * UpdateUserDto
 *
 * Fields a user can change on their own profile.
 * Role and isActive are intentionally excluded — those are admin operations.
 * walletAddress is managed exclusively by the WalletModule.
 */
export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'player@arena.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'player1' })
  @IsOptional()
  @IsString()
  @Length(3, 20)
  username?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatar.png' })
  @IsOptional()
  @IsString()
  avatar?: string;
}
