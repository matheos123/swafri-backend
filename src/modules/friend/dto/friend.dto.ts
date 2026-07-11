import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class SendFriendRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  addresseeId!: string;
}

export class RespondFriendRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  friendshipId!: string;

  @ApiProperty({ enum: ['ACCEPTED', 'BLOCKED'] })
  @IsNotEmpty()
  @IsIn(['ACCEPTED', 'BLOCKED'])
  action!: 'ACCEPTED' | 'BLOCKED';
}
