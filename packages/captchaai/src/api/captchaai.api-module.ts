import { Module } from '@nestjs/common';
import { CaptchaAIController } from './captchaai.controller';
import { CaptchaAIService } from './captchaai.service';

@Module({
  controllers: [CaptchaAIController],
  providers: [CaptchaAIService],
})
export class CaptchaAIApiModule {}
