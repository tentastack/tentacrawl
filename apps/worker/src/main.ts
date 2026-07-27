import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { PinoNestLogger } from '@tentacrawl/core/logger';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const app = await NestFactory.create(WorkerModule, {
    bufferLogs: true,
  });
  app.useLogger(new PinoNestLogger({ name: 'tentacrawl-worker' }));
  app.flushLogs();

  const port = process.env['PORT'] ?? 3002;
  await app.listen(port);

  Logger.log(`Worker listening on port ${port}`, 'Bootstrap');
}

bootstrap();
