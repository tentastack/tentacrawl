import { Global, Module } from '@nestjs/common';
import { ChallengerRegistry } from './challenger.registry';

@Global()
@Module({
  providers: [ChallengerRegistry],
  exports: [ChallengerRegistry],
})
export class CoreExtensionModule {}
