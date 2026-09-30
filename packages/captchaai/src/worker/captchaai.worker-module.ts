import { Module } from '@nestjs/common';
import { CaptchaAISolverService } from './captchaai-solver.service';
import { CaptchaAIChallengerExtension } from './captchaai.challenger';

@Module({
  providers: [CaptchaAISolverService, CaptchaAIChallengerExtension],
  exports: [CaptchaAISolverService],
})
export class CaptchaAIWorkerModule {}
