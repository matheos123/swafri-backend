import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { Move } from '../engine/rps.engine';

export enum MoveEnum {
  ROCK = 'rock',
  PAPER = 'paper',
  SCISSORS = 'scissors',
}

export class SubmitMoveDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  roomId!: string;

  @ApiProperty({ enum: MoveEnum })
  @IsEnum(MoveEnum)
  move!: Move;
}
