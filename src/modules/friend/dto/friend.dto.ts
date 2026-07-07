import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

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
  action!: 'ACCEPTED' | 'BLOCKED';
}
