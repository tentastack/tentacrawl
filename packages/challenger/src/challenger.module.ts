import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';

@Module({})
export class ChallengerModule {
  static forApi(): DynamicModule {
    return {
      module: ChallengerModule,
      imports: [
        require('./api/challenger.api-module').ChallengerApiModule,
      ],
    };
  }

  static forWorker(): DynamicModule {
    return {
      module: ChallengerModule,
      imports: [
        require('./worker/challenger.worker-module').ChallengerWorkerModule,
      ],
    };
  }
}
