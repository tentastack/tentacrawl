import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';

@Module({})
export class CrawlerModule {
  static forApi(): DynamicModule {
    return {
      module: CrawlerModule,
      imports: [
        require('./api/crawler.api-module').CrawlerApiModule,
      ],
    };
  }

  static forWorker(): DynamicModule {
    return {
      module: CrawlerModule,
      imports: [
        require('./worker/crawler.worker-module').CrawlerWorkerModule,
      ],
    };
  }
}
