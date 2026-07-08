import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthService } from '../service/health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: 'Service health check',
    description:
      'Root path `GET /health` (excluded from `/api/v1` prefix). Use this for Render and load balancer health checks.',
  })
  @ApiOkResponse({
    schema: {
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2026-07-08T12:00:00.000Z' },
      },
    },
  })
  check() {
    return this.healthService.check();
  }
}
