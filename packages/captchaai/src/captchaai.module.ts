import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';

// the class name is derived by @tentacrawl/cli from the module id in modules.config.ts
@Module({})
export class CaptchaaiModule {
  static forWorker(): DynamicModule {
    return {
      module: CaptchaaiModule,
      imports: [
        require('./worker/captchaai.worker-module').CaptchaAIWorkerModule,
      ],
    };
  }

  static forApi(): DynamicModule {
    return {
      module: CaptchaaiModule,
      imports: [
        require('./api/captchaai.api-module').CaptchaAIApiModule,
      ],
    };
  }
}
