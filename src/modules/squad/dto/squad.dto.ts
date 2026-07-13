import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsUUID, MaxLength } from 'class-validator';

export class CreateSquadDto {
  @ApiProperty({ example: 'Elite Warriors', description: 'Squad name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;

  @ApiPropertyOptional({ example: 'Best squad in the arena', description: 'Squad description' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  description?: string;
}

export class UpdateSquadDto {
  @ApiPropertyOptional({ example: 'Elite Warriors Updated' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  description?: string;
}

export class InviteToSquadDto {
  @ApiProperty({ example: 'user-uuid', description: 'User ID to invite (must be a friend)' })
  @IsUUID()
  @IsNotEmpty()
  userId!: string;
}

export class RespondToSquadInviteDto {
  @ApiProperty({ example: 'ACCEPTED', enum: ['ACCEPTED', 'DECLINED'] })
  @IsEnum(['ACCEPTED', 'DECLINED'])
  @IsNotEmpty()
  action!: 'ACCEPTED' | 'DECLINED';
}

export class KickMemberDto {
  @ApiProperty({ example: 'user-uuid', description: 'User ID to kick from squad' })
  @IsUUID()
  @IsNotEmpty()
  userId!: string;
}

export class PromoteMemberDto {
  @ApiProperty({ example: 'user-uuid', description: 'User ID to promote' })
  @IsUUID()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ example: 'ADMIN', enum: ['ADMIN', 'MEMBER'] })
  @IsEnum(['ADMIN', 'MEMBER'])
  @IsNotEmpty()
  role!: 'ADMIN' | 'MEMBER';
}
