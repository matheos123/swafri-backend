import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../core/guard/jwt-auth.guard';
import { CurrentUser } from '../../../core/decorator/current-user.decorator';
import { SquadService } from '../service/squad.service';
import {
  CreateSquadDto,
  UpdateSquadDto,
  InviteToSquadDto,
  RespondToSquadInviteDto,
  KickMemberDto,
  PromoteMemberDto,
} from '../dto/squad.dto';

@ApiTags('Squads')
@Controller('squads')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SquadController {
  constructor(private readonly squadService: SquadService) {}

  // ─── Squad CRUD ───────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a new squad' })
  @ApiResponse({ status: 201, description: 'Squad created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createSquad(@CurrentUser('id') userId: string, @Body() dto: CreateSquadDto) {
    const squad = await this.squadService.createSquad(userId, dto);
    return {
      success: true,
      data: squad,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all squads user is a member of' })
  @ApiResponse({ status: 200, description: 'Squads retrieved successfully' })
  async getUserSquads(@CurrentUser('id') userId: string) {
    const squads = await this.squadService.getUserSquads(userId);
    return {
      success: true,
      data: squads,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get squad details by ID' })
  @ApiResponse({ status: 200, description: 'Squad retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Squad not found' })
  async getSquadById(@Param('id') squadId: string, @CurrentUser('id') userId: string) {
    const squad = await this.squadService.getSquadById(squadId, userId);
    return {
      success: true,
      data: squad,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update squad details (owner/admin only)' })
  @ApiResponse({ status: 200, description: 'Squad updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Squad not found' })
  async updateSquad(
    @Param('id') squadId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateSquadDto,
  ) {
    const squad = await this.squadService.updateSquad(squadId, userId, dto);
    return {
      success: true,
      data: squad,
      message: 'Squad updated successfully',
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete squad (owner only)' })
  @ApiResponse({ status: 200, description: 'Squad deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - only owner can delete' })
  @ApiResponse({ status: 404, description: 'Squad not found' })
  async deleteSquad(@Param('id') squadId: string, @CurrentUser('id') userId: string) {
    const result = await this.squadService.deleteSquad(squadId, userId);
    return {
      success: true,
      message: result.message,
    };
  }

  // ─── Member Management ────────────────────────────────────────────────────

  @Post(':id/invite')
  @ApiOperation({ summary: 'Invite a friend to the squad' })
  @ApiResponse({ status: 201, description: 'Invite sent successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - user not a friend or already invited' })
  @ApiResponse({ status: 403, description: 'Forbidden - not a squad member' })
  async inviteToSquad(
    @Param('id') squadId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: InviteToSquadDto,
  ) {
    const invite = await this.squadService.inviteToSquad(squadId, userId, dto);
    return {
      success: true,
      data: invite,
      message: 'Squad invite sent successfully',
    };
  }

  @Get('invites/pending')
  @ApiOperation({ summary: 'Get pending squad invites for current user' })
  @ApiResponse({ status: 200, description: 'Invites retrieved successfully' })
  async getPendingInvites(@CurrentUser('id') userId: string) {
    const invites = await this.squadService.getUserInvites(userId);
    return {
      success: true,
      data: invites,
    };
  }

  @Post('invites/:inviteId/respond')
  @ApiOperation({ summary: 'Respond to a squad invite (accept/decline)' })
  @ApiResponse({ status: 200, description: 'Response recorded successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - invite already responded to' })
  @ApiResponse({ status: 404, description: 'Invite not found' })
  async respondToInvite(
    @Param('inviteId') inviteId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: RespondToSquadInviteDto,
  ) {
    const result = await this.squadService.respondToInvite(inviteId, userId, dto);
    return {
      success: true,
      data: result,
      message: result.message,
    };
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'Get squad members list' })
  @ApiResponse({ status: 200, description: 'Members retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Squad not found' })
  async getSquadMembers(@Param('id') squadId: string) {
    const members = await this.squadService.getSquadMembers(squadId);
    return {
      success: true,
      data: members,
    };
  }

  @Post(':id/leave')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Leave a squad' })
  @ApiResponse({ status: 200, description: 'Left squad successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - owner cannot leave' })
  @ApiResponse({ status: 404, description: 'Squad not found or not a member' })
  async leaveSquad(@Param('id') squadId: string, @CurrentUser('id') userId: string) {
    const result = await this.squadService.leaveSquad(squadId, userId);
    return {
      success: true,
      message: result.message,
    };
  }

  @Delete(':id/members/:memberId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kick a member from the squad (owner/admin only)' })
  @ApiResponse({ status: 200, description: 'Member removed successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Squad or member not found' })
  async kickMember(
    @Param('id') squadId: string,
    @Param('memberId') memberId: string,
    @CurrentUser('id') userId: string,
  ) {
    const result = await this.squadService.kickMember(squadId, userId, memberId);
    return {
      success: true,
      message: result.message,
    };
  }

  @Patch(':id/members/:memberId/role')
  @ApiOperation({ summary: 'Change member role (owner only)' })
  @ApiResponse({ status: 200, description: 'Member role updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - only owner can change roles' })
  @ApiResponse({ status: 404, description: 'Squad or member not found' })
  async changeMemberRole(
    @Param('id') squadId: string,
    @Param('memberId') memberId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: PromoteMemberDto,
  ) {
    const result = await this.squadService.changeMemberRole(squadId, userId, memberId, dto.role);
    return {
      success: true,
      message: result.message,
    };
  }
}
