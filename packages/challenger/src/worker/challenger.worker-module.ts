import { Global, Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CHALLENGER_DISPATCHER } from '@tentacrawl/core';
import {
  ChallengerConfigEntity,
  ChallengerRegistrationEntity,
  ChallengerSignalEntity,
} from '../data/entities';
import { ChallengerDispatcherService } from './challenger-dispatcher.service';
import { ChallengerRegistrationSyncService } from './challenger-registration.sync';
import { ChallengerSignalBus } from './challenger-signal.bus';
import { ChallengerActionRegistryService } from './challenger-action.registry';

@Global()
@Module({
  imports: [
    MikroOrmModule.forFeature([
      ChallengerRegistrationEntity,
      ChallengerConfigEntity,
      ChallengerSignalEntity,
    ]),
  ],
  providers: [
    ChallengerSignalBus,
    ChallengerActionRegistryService,
    ChallengerDispatcherService,
    ChallengerRegistrationSyncService,
    {
      provide: CHALLENGER_DISPATCHER,
      useExisting: ChallengerDispatcherService,
    },
  ],
  exports: [ChallengerDispatcherService, CHALLENGER_DISPATCHER],
})
export class ChallengerWorkerModule {}
