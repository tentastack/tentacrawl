import { Controller, Get } from '@nestjs/common';
import { CaptchaAIService } from './captchaai.service';

@Controller('captchaai')
export class CaptchaAIController {
  constructor(private readonly service: CaptchaAIService) {}

  @Get('status')
  status() {
    return this.service.status();
  }

  @Get('balance')
  balance() {
    return this.service.balance();
  }
}
