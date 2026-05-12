import { Global, Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { NOTIFICATION_PUBLISHER } from '@tentacrawl/core/notification';
import { NotificationEntity } from '../data/entities';
import { NotificationPublisherService } from './notification-publisher.service';

@Global()
@Module({
  imports: [MikroOrmModule.forFeature([NotificationEntity])],
  providers: [
    NotificationPublisherService,
    {
      provide: NOTIFICATION_PUBLISHER,
      useExisting: NotificationPublisherService,
    },
  ],
  exports: [NotificationPublisherService, NOTIFICATION_PUBLISHER],
})
export class NotificationWorkerModule {}