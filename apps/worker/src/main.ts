import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const app = await NestFactory.create(WorkerModule, {
    bufferLogs: true,
  });

  const port = process.env['PORT'] ?? 3001;
  await app.listen(port);

  Logger.log(`Worker listening on port ${port}`, 'Bootstrap');
}

bootstrap();
