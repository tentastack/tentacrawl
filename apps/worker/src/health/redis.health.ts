import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus';
import { SCRAPE_QUEUE } from '@tentacrawl/core';

// pings Redis via the existing BullMQ connection rather than a new client
@Injectable()
export class RedisHealthIndicator {
  constructor(
    @InjectQueue(SCRAPE_QUEUE) private readonly queue: Queue,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      const client = await this.queue.client;
      const pong = await client.ping();
      return pong === 'PONG'
        ? indicator.up()
        : indicator.down({ message: `Unexpected PING reply: ${pong}` });
    } catch (error) {
      return indicator.down({ message: (error as Error).message });
    }
  }
}
