import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import {
  ChallengerConfigEntity,
  ChallengerRegistrationEntity,
  ChallengerSignalEntity,
} from '../data/entities';
import { ChallengerController } from './challenger.controller';
import { ChallengerApiService } from './challenger.service';

@Module({
  imports: [
    MikroOrmModule.forFeature([
      ChallengerRegistrationEntity,
      ChallengerConfigEntity,
      ChallengerSignalEntity,
    ]),
  ],
  controllers: [ChallengerController],
  providers: [ChallengerApiService],
  exports: [ChallengerApiService],
})
export class ChallengerApiModule {}
