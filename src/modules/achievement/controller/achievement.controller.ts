import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AchievementService } from '../service/achievement.service';
import { JwtAuthGuard } from '../../../core/guard/jwt-auth.guard';
import { CurrentUser } from '../../../core/decorator/current-user.decorator';

@ApiTags('Achievements')
@Controller('achievements')
export class AchievementController {
  constructor(private readonly achievementService: AchievementService) {}

  /**
   * GET /achievements
   * Public — list all available achievement badges with criteria.
   */
  @Get()
  @ApiOperation({ summary: 'List all available achievement badges' })
  getAll() {
    return this.achievementService.getAllAchievements();
  }

  /**
   * GET /achievements/me
   * Authenticated — returns the current user's earned badges.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get your earned achievement badges' })
  getMyAchievements(@CurrentUser('userId') userId: string) {
    return this.achievementService.getUserAchievements(userId);
  }

  /**
   * GET /achievements/user/:userId
   * Public — returns a specific player's earned badges.
   */
  @Get('user/:userId')
  @ApiOperation({ summary: "Get a player's earned achievement badges by user ID" })
  getByUser(@Param('userId') userId: string) {
    return this.achievementService.getUserAchievements(userId);
  }
}
