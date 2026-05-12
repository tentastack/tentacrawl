import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';

@Module({})
export class ScraperModule {
  static forApi(): DynamicModule {
    return {
      module: ScraperModule,
      imports: [
        require('./api/scraper.api-module').ScraperApiModule,
      ],
    };
  }

  static forWorker(): DynamicModule {
    return {
      module: ScraperModule,
      imports: [
        require('./worker/scraper.worker-module').ScraperWorkerModule,
      ],
    };
  }
}
