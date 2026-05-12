import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';

@Module({})
export class NotificationModule {
  static forApi(): DynamicModule {
    return {
      module: NotificationModule,
      imports: [require('./api/notification.api-module').NotificationApiModule],
    };
  }

  static forWorker(): DynamicModule {
    return {
      module: NotificationModule,
      imports: [require('./worker/notification.worker-module').NotificationWorkerModule],
    };
  }
}