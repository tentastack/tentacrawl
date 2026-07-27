import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TerminusModule } from '@nestjs/terminus';
import { SCRAPE_QUEUE } from '@tentacrawl/core';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './redis.health';

@Module({
  imports: [TerminusModule, BullModule.registerQueue({ name: SCRAPE_QUEUE })],
  controllers: [HealthController],
  providers: [RedisHealthIndicator],
})
export class HealthModule {}
