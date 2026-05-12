import { Controller, Get } from '@nestjs/common';
import { WorkerPresenceService } from '@tentacrawl/admin';

@Controller('health')
export class HealthController {
  constructor(private readonly workerPresenceService: WorkerPresenceService) {}

  @Get()
  check() {
    const runtime = this.workerPresenceService.getSnapshot();

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      runtime,
    };
  }
}
