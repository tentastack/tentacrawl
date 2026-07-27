import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MikroOrmHealthIndicator,
} from '@nestjs/terminus';
import { RedisHealthIndicator } from './redis.health';

const DB_PING_TIMEOUT_MS = 2_000;

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: MikroOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  // dependency-free, so a transient DB/Redis blip never restarts the container
  @Get('live')
  live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.readiness();
  }

  @Get()
  @HealthCheck()
  check() {
    return this.readiness();
  }

  private readiness() {
    return this.health.check([
      () => this.db.pingCheck('mongo', { timeout: DB_PING_TIMEOUT_MS }),
      () => this.redis.isHealthy('redis'),
    ]);
  }
}
