import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CaptchaAIClient, CaptchaAIError } from '../captchaai.client';
import { createCaptchaAIClient, loadCaptchaaiConfig, type CaptchaaiConfig } from '../config';
import type { CaptchaSolveRequest } from '../data/schemas';

@Injectable()
export class CaptchaAISolverService {
  private readonly logger = new Logger(CaptchaAISolverService.name);
  private readonly config: CaptchaaiConfig;
  private readonly client?: CaptchaAIClient;

  constructor(@Optional() configService?: ConfigService) {
    this.config = loadCaptchaaiConfig(configService);
    this.client = createCaptchaAIClient(this.config);
    if (!this.client) {
      this.logger.warn(
        'CAPTCHAAI_API_KEY is not set; the CaptchaAI challenger reports challenges but cannot solve them',
      );
    }
  }

  get configured(): boolean {
    return this.client !== undefined;
  }

  get baseUrl(): string {
    return this.config.CAPTCHAAI_BASE_URL;
  }

  get solveTimeoutMs(): number {
    return this.config.CAPTCHAAI_TIMEOUT_MS;
  }

  async solve(request: CaptchaSolveRequest): Promise<string> {
    const client = this.requireClient();

    switch (request.kind) {
      case 'recaptcha-v2':
        return client.solveRecaptchaV2({
          sitekey: request.sitekey,
          pageurl: request.pageurl,
          invisible: request.invisible,
        });
      case 'recaptcha-enterprise':
        return client.solveRecaptchaV2({
          sitekey: request.sitekey,
          pageurl: request.pageurl,
          invisible: request.invisible,
          enterprise: true,
        });
      case 'recaptcha-v3':
        return client.solveRecaptchaV3({
          sitekey: request.sitekey,
          pageurl: request.pageurl,
          action: request.action,
          minScore: request.minScore,
          enterprise: request.enterprise,
        });
      case 'turnstile':
        return client.solveTurnstile({
          sitekey: request.sitekey,
          pageurl: request.pageurl,
          action: request.action,
        });
      case 'image':
        return client.solveImage({ body: request.body });
    }
  }

  getBalance(): Promise<number> {
    return this.requireClient().getBalance();
  }

  private requireClient(): CaptchaAIClient {
    if (!this.client) {
      throw new CaptchaAIError('CAPTCHAAI_API_KEY is not configured', 'NOT_CONFIGURED');
    }
    return this.client;
  }
}
