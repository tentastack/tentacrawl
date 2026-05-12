import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';

@Module({})
export class ProxyModule {
  static forWorker(): DynamicModule {
    return {
      module: ProxyModule,
      imports: [
        require('./worker/proxy.worker-module').ProxyWorkerModule,
      ],
    };
  }

  static forApi(): DynamicModule {
    return {
      module: ProxyModule,
      imports: [
        require('./api/proxy.api-module').ProxyApiModule,
      ],
    };
  }
}
