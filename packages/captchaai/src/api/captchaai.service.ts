import { Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CaptchaAIClient } from '../captchaai.client';
import { createCaptchaAIClient, loadCaptchaaiConfig, type CaptchaaiConfig } from '../config';
import type { CaptchaaiStatus } from '../data/schemas';

@Injectable()
export class CaptchaAIService {
  private readonly config: CaptchaaiConfig;
  private readonly client?: CaptchaAIClient;

  constructor(@Optional() configService?: ConfigService) {
    this.config = loadCaptchaaiConfig(configService);
    this.client = createCaptchaAIClient(this.config);
  }

  // never reports the key itself, only whether one is configured
  status(): CaptchaaiStatus {
    return { configured: this.client !== undefined, baseUrl: this.config.CAPTCHAAI_BASE_URL };
  }

  async balance(): Promise<{ balance: number }> {
    if (!this.client) {
      throw new ServiceUnavailableException('CAPTCHAAI_API_KEY is not configured');
    }
    return { balance: await this.client.getBalance() };
  }
}
