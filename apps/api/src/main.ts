import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { createPinoRootLogger, PinoNestLogger } from '@tentacrawl/core/logger';
import { AppModule } from './app.module';

function parseCorsOrigins(value: string): string[] {
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

async function bootstrap() {
  const rootLogger = createPinoRootLogger({ name: 'tentacrawl-api' });
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(new PinoNestLogger(rootLogger));
  app.flushLogs();

  // CORP relaxed: the web app consumes this API cross-origin
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // correlation id echoed back to the caller; health/metrics excluded from logs
  app.use(
    pinoHttp({
      logger: rootLogger,
      autoLogging: {
        ignore: (req) => {
          const url = req.url ?? '';
          return url.startsWith('/health') || url.startsWith('/metrics');
        },
      },
      genReqId: (req, res) => {
        const header = req.headers['x-correlation-id'];
        const id = (Array.isArray(header) ? header[0] : header) || randomUUID();
        res.setHeader('x-correlation-id', id);
        return id;
      },
    }),
  );

  const allowedOrigins = parseCorsOrigins(
    process.env['CORS_ORIGIN'] ?? 'http://localhost:3001,http://127.0.0.1:3001',
  );

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
    },
    credentials: true,
  });

  const port = process.env['PORT'] ?? 3000;
  await app.listen(port);

  Logger.log(`API listening on port ${port}`, 'Bootstrap');
}

bootstrap();
