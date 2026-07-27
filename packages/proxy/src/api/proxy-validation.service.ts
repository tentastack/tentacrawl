import { Injectable, Logger } from '@nestjs/common';
import { ProxyAgent, fetch as undiciFetch } from 'undici';
import type { TestProxyEndpointDto, ProxyValidationResult } from '../data/schemas';

// Any HTTPS-capable endpoint works here since we only need the exit IP as seen
// by the target — this one also returns city/country/org for the details panel.
const VALIDATION_URL = 'https://ipinfo.io/json';
const VALIDATION_TIMEOUT_MS = 10_000;

interface IpInfoResponse {
  ip?: string;
  city?: string;
  region?: string;
  country?: string;
  org?: string;
}

// scheme-less "host:port" is a valid Playwright HTTP proxy but not a valid
// URL for undici's ProxyAgent, which requires an explicit scheme
function normalizeProxyUri(url: string): string {
  return /^[a-z0-9]+:\/\//i.test(url) ? url : `http://${url}`;
}

// undici's fetch() wraps every dispatch failure in layers of generic errors —
// TypeError('fetch failed') -> DOMException('Request was cancelled.') -> the
// actual cause (e.g. RequestAbortedError('Proxy response (407) !== 200 when
// HTTP Tunneling')). Walk to the deepest cause to find the useful message.
function deepestCause(err: unknown): Error | undefined {
  let root: Error | undefined;
  let current = err;
  while (current instanceof Error) {
    root = current;
    current = current.cause;
  }
  return root;
}

function describeError(err: unknown): string {
  const root = deepestCause(err);
  if (!root) {
    return 'Unknown error while testing the proxy';
  }

  const message = root.message;
  const code = (root as NodeJS.ErrnoException).code;
  if (root.name === 'TimeoutError' || /timeout/i.test(message)) {
    return 'Timed out connecting through the proxy';
  }
  if (code === 'ECONNREFUSED' || /ECONNREFUSED/.test(message)) {
    return 'Connection refused by the proxy host';
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || /ENOTFOUND|EAI_AGAIN/.test(message)) {
    return 'Proxy host could not be resolved';
  }
  if (/\b407\b/.test(message)) {
    return 'Proxy rejected the credentials (407 Proxy Authentication Required)';
  }
  return message;
}

@Injectable()
export class ProxyValidationService {
  private readonly logger = new Logger(ProxyValidationService.name);

  async test(dto: TestProxyEndpointDto): Promise<ProxyValidationResult> {
    if (/^socks5:\/\//i.test(dto.url.trim())) {
      return {
        ok: false,
        error: 'SOCKS5 proxies cannot be auto-validated yet. Save without testing.',
      };
    }

    const agent = new ProxyAgent({
      uri: normalizeProxyUri(dto.url.trim()),
      token: dto.username
        ? `Basic ${Buffer.from(`${dto.username}:${dto.password ?? ''}`).toString('base64')}`
        : undefined,
    });

    const startedAt = Date.now();
    try {
      const response = await undiciFetch(VALIDATION_URL, {
        dispatcher: agent,
        signal: AbortSignal.timeout(VALIDATION_TIMEOUT_MS),
      });
      const latencyMs = Date.now() - startedAt;

      if (!response.ok) {
        return { ok: false, error: `Proxy responded with HTTP ${response.status}` };
      }

      const body = (await response.json()) as IpInfoResponse;
      return {
        ok: true,
        details: {
          ip: body.ip,
          city: body.city,
          region: body.region,
          country: body.country,
          org: body.org,
          latencyMs,
        },
      };
    } catch (err) {
      const error = describeError(err);
      this.logger.warn(`Proxy validation failed for ${dto.url}: ${error}`);
      return { ok: false, error };
    } finally {
      await agent.close();
    }
  }
}
