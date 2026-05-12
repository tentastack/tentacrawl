import { Global, Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ACTIVITY_LOG_RECORDER } from '@tentacrawl/core/activity';
import { ActivityLogEntity, WorkerInstanceEntity } from '../data/entities';
import { ActivityLogRecorderService } from './activity-log-recorder.service';
import { WorkerPresenceService } from './worker-presence.service';

@Global()
@Module({
  imports: [MikroOrmModule.forFeature([ActivityLogEntity, WorkerInstanceEntity])],
  providers: [
    ActivityLogRecorderService,
    WorkerPresenceService,
    {
      provide: ACTIVITY_LOG_RECORDER,
      useExisting: ActivityLogRecorderService,
    },
  ],
  exports: [ActivityLogRecorderService, WorkerPresenceService, ACTIVITY_LOG_RECORDER],
})
export class AdminWorkerModule {}