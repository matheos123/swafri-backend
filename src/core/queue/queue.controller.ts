import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { QueueService } from './queue.service';
import { JwtAuthGuard } from '../guard/jwt-auth.guard';
import { RolesGuard } from '../guard/roles.guard';
import { Roles } from '../decorator/roles.decorator';

@ApiTags('Queue Management')
@Controller('queue')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Get('status')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get status of all queues (admin only)' })
  @ApiResponse({ status: 200, description: 'Queue status retrieved' })
  async getQueueStatus() {
    return {
      success: true,
      data: await this.queueService.getAllQueueStatus(),
    };
  }

  @Get('status/:queueName')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get status of a specific queue (admin only)' })
  @ApiResponse({ status: 200, description: 'Queue status retrieved' })
  async getSpecificQueueStatus(@Param('queueName') queueName: 'blockchain' | 'email') {
    const status = queueName === 'blockchain'
      ? await this.queueService.getBlockchainQueueStatus()
      : await this.queueService.getEmailQueueStatus();

    return {
      success: true,
      data: status,
    };
  }

  @Post('retry/:queueName')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Retry all failed jobs in a queue (admin only)' })
  @ApiResponse({ status: 200, description: 'Failed jobs retried' })
  async retryFailedJobs(@Param('queueName') queueName: 'blockchain' | 'email') {
    const retriedCount = await this.queueService.retryFailedJobs(queueName);
    
    return {
      success: true,
      data: {
        queueName,
        retriedCount,
        message: `${retriedCount} failed job(s) retried`,
      },
    };
  }

  @Post('clean/:queueName/completed')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Clear completed jobs from a queue (admin only)' })
  @ApiResponse({ status: 200, description: 'Completed jobs cleared' })
  async clearCompletedJobs(@Param('queueName') queueName: 'blockchain' | 'email') {
    await this.queueService.clearCompletedJobs(queueName);
    
    return {
      success: true,
      data: {
        queueName,
        message: 'Completed jobs cleared',
      },
    };
  }

  @Post('clean/:queueName/failed')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Clear failed jobs from a queue (admin only)' })
  @ApiResponse({ status: 200, description: 'Failed jobs cleared' })
  async clearFailedJobs(@Param('queueName') queueName: 'blockchain' | 'email') {
    await this.queueService.clearFailedJobs(queueName);
    
    return {
      success: true,
      data: {
        queueName,
        message: 'Failed jobs cleared',
      },
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Check queue system health (public)' })
  @ApiResponse({ status: 200, description: 'Queue health status' })
  async getQueueHealth() {
    const [blockchainStatus, emailStatus] = await this.queueService.getAllQueueStatus();
    
    const isHealthy = 
      blockchainStatus.failed === 0 && 
      emailStatus.failed === 0 &&
      blockchainStatus.active >= 0 && 
      emailStatus.active >= 0;
    
    return {
      success: true,
      data: {
        healthy: isHealthy,
        queues: {
          blockchain: {
            status: blockchainStatus.failed === 0 ? 'healthy' : 'degraded',
            ...blockchainStatus,
          },
          email: {
            status: emailStatus.failed === 0 ? 'healthy' : 'degraded',
            ...emailStatus,
          },
        },
        timestamp: new Date().toISOString(),
      },
    };
  }
}
