import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check(): { status: 'ok'; service: 'socialflow-api'; timestamp: string } {
    return {
      status: 'ok',
      service: 'socialflow-api',
      timestamp: new Date().toISOString(),
    };
  }
}
