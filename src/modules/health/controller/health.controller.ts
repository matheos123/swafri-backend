import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from '../service/health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOkResponse({ schema: { properties: { status: { type: 'string' }, timestamp: { type: 'string' } } } })
  check() { return this.healthService.check(); }
}
