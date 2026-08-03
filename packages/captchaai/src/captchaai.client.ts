import { z } from 'zod';

export const CAPTCHAAI_BASE_URL = 'https://ocr.captchaai.com';

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_TIMEOUT_MS = 120_000;
const REQUEST_TIMEOUT_MS = 30_000;
const NOT_READY = 'CAPCHA_NOT_READY';

export interface CaptchaAIFetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

export interface CaptchaAIFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type CaptchaAIFetch = (
  url: string,
  init?: CaptchaAIFetchInit,
) => Promise<CaptchaAIFetchResponse>;

export class CaptchaAIError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'CaptchaAIError';
    this.code = code;
  }
}

export interface CaptchaAIClientOptions {
  apiKey: string;
  baseUrl?: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
  fetchImpl?: CaptchaAIFetch;
  sleep?: (ms: number) => Promise<void>;
}

export interface RecaptchaV2Request {
  sitekey: string;
  pageurl: string;
  invisible?: boolean;
  enterprise?: boolean;
  dataS?: string;
}

export interface RecaptchaV3Request {
  sitekey: string;
  pageurl: string;
  action?: string;
  minScore?: number;
  enterprise?: boolean;
}

export interface TurnstileRequest {
  sitekey: string;
  pageurl: string;
  action?: string;
}

export interface ImageRequest {
  body: string;
  phrase?: boolean;
  numeric?: number;
  minLength?: number;
  maxLength?: number;
}

const apiResponseSchema = z.object({
  status: z.coerce.number(),
  request: z.string(),
  error_text: z.string().optional(),
});

type ApiResponse = z.infer<typeof apiResponseSchema>;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 2Captcha-compatible HTTP client for https://ocr.captchaai.com.
// CaptchaAI does not solve hCaptcha, FunCaptcha/Arkose, GeeTest or DataDome,
// so this client deliberately exposes no methods for them.
export class CaptchaAIClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly pollIntervalMs: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: CaptchaAIFetch;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: CaptchaAIClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? CAPTCHAAI_BASE_URL).replace(/\/+$/, '');
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init));
    this.sleep = options.sleep ?? delay;
  }

  solveRecaptchaV2(request: RecaptchaV2Request): Promise<string> {
    const params: Record<string, string> = {
      method: 'userrecaptcha',
      googlekey: request.sitekey,
      pageurl: request.pageurl,
    };
    if (request.invisible) params.invisible = '1';
    if (request.enterprise) params.enterprise = '1';
    if (request.dataS) params['data-s'] = request.dataS;
    return this.solve(params);
  }

  solveRecaptchaV3(request: RecaptchaV3Request): Promise<string> {
    const params: Record<string, string> = {
      method: 'userrecaptcha',
      version: 'v3',
      googlekey: request.sitekey,
      pageurl: request.pageurl,
      action: request.action ?? 'verify',
      min_score: String(request.minScore ?? 0.3),
    };
    if (request.enterprise) params.enterprise = '1';
    return this.solve(params);
  }

  solveTurnstile(request: TurnstileRequest): Promise<string> {
    const params: Record<string, string> = {
      method: 'turnstile',
      sitekey: request.sitekey,
      pageurl: request.pageurl,
    };
    if (request.action) params.action = request.action;
    return this.solve(params);
  }

  solveImage(request: ImageRequest): Promise<string> {
    const params: Record<string, string> = {
      method: 'base64',
      body: request.body,
    };
    if (request.phrase) params.phrase = '1';
    if (request.numeric !== undefined) params.numeric = String(request.numeric);
    if (request.minLength !== undefined) params.min_len = String(request.minLength);
    if (request.maxLength !== undefined) params.max_len = String(request.maxLength);
    return this.solve(params);
  }

  async getBalance(): Promise<number> {
    const response = await this.get({ action: 'getbalance' });
    const balance = Number(response.request);
    if (!Number.isFinite(balance)) {
      throw new CaptchaAIError(`Unexpected balance response: ${response.request}`);
    }
    return balance;
  }

  private async solve(params: Record<string, string>): Promise<string> {
    const id = await this.submit(params);
    return this.poll(id);
  }

  private async submit(params: Record<string, string>): Promise<string> {
    const body = new URLSearchParams({ key: this.apiKey, json: '1', ...params });
    const response = await this.request(`${this.baseUrl}/in.php`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (response.status !== 1) {
      throw new CaptchaAIError(
        `CaptchaAI rejected the task: ${response.error_text ?? response.request}`,
        response.request,
      );
    }
    return response.request;
  }

  private async poll(id: string): Promise<string> {
    const deadline = Date.now() + this.timeoutMs;
    while (Date.now() < deadline) {
      await this.sleep(this.pollIntervalMs);
      const response = await this.get({ action: 'get', id });
      if (response.status === 1) return response.request;
      if (response.request !== NOT_READY) {
        throw new CaptchaAIError(
          `CaptchaAI failed to solve task ${id}: ${response.error_text ?? response.request}`,
          response.request,
        );
      }
    }
    throw new CaptchaAIError(
      `CaptchaAI task ${id} timed out after ${this.timeoutMs}ms`,
      'TIMEOUT',
    );
  }

  private async get(params: Record<string, string>): Promise<ApiResponse> {
    const query = new URLSearchParams({ key: this.apiKey, json: '1', ...params });
    return this.request(`${this.baseUrl}/res.php?${query.toString()}`);
  }

  private async request(url: string, init?: CaptchaAIFetchInit): Promise<ApiResponse> {
    const response = await this.fetchImpl(url, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new CaptchaAIError(`CaptchaAI responded with HTTP ${response.status}`);
    }
    const parsed = apiResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new CaptchaAIError('CaptchaAI returned an unexpected payload');
    }
    return parsed.data;
  }
}
