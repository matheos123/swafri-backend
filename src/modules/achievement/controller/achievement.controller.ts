import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AchievementService } from '../service/achievement.service';

@ApiTags('Achievements')
@Controller('achievements')
export class AchievementController {
  constructor(private readonly achievementService: AchievementService) {}

  @Get()
  getAll() { return this.achievementService.getAllAchievements(); }

  @Get('user/:userId')
  getByUser(@Param('userId') userId: string) { return this.achievementService.getUserAchievements(userId); }
}
