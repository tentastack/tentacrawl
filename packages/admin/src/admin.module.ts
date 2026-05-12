import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';

@Module({})
export class AdminModule {
  static forApi(): DynamicModule {
    return {
      module: AdminModule,
      imports: [require('./api/admin.api-module').AdminApiModule],
    };
  }

  static forWorker(): DynamicModule {
    return {
      module: AdminModule,
      imports: [require('./worker/admin.worker-module').AdminWorkerModule],
    };
  }
}