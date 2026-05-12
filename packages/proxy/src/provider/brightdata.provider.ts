import type { ConfigService } from '@nestjs/config';
import type {
  ProxyProvider,
  ProxySession,
  ProxyEndpoint,
  AcquireOptions,
} from './proxy-provider.interface';
import { ProxyProviderMeta } from './proxy-provider.decorator';
import { brightdataPoolConfigSchema } from './brightdata.config';

export interface BrightDataConfig {
  zone: string;
  customer: string;
  password: string;
  host?: string;
  port?: number;
  country?: string;
}

@ProxyProviderMeta({
  id: 'brightdata',
  name: 'Bright Data',
  description: 'Residential/datacenter proxy network with session management',
  configSchema: brightdataPoolConfigSchema,
})
export class BrightDataProvider implements ProxyProvider {
  readonly name = 'brightdata';
  private readonly config: BrightDataConfig;
  private readonly host: string;
  private readonly port: number;

  constructor(config: BrightDataConfig) {
    this.config = config;
    this.host = config.host ?? 'brd.superproxy.io';
    this.port = config.port ?? 22225;
  }

  static fromPoolConfig(raw: Record<string, unknown>): BrightDataProvider {
    const config = brightdataPoolConfigSchema.parse(raw);
    return new BrightDataProvider(config);
  }

  static fromEnv(config: ConfigService): BrightDataProvider | null {
    const zone = config.get<string>('BRIGHTDATA_ZONE');
    const customer = config.get<string>('BRIGHTDATA_CUSTOMER');
    const password = config.get<string>('BRIGHTDATA_PASSWORD');
    if (!zone || !customer || !password) return null;

    return new BrightDataProvider({
      zone,
      customer,
      password,
      host: config.get('BRIGHTDATA_HOST'),
      port: config.get<number>('BRIGHTDATA_PORT'),
      country: config.get('BRIGHTDATA_COUNTRY'),
    });
  }

  async acquireSession(options?: AcquireOptions): Promise<ProxySession> {
    const sessionId = this.generateSessionId();
    const endpoint = this.buildEndpoint(sessionId, options?.country);

    return {
      sessionId,
      endpoint,
      createdAt: new Date(),
    };
  }

  async releaseSession(_sessionId: string): Promise<void> {
    // BrightData sessions expire automatically; no explicit release needed
  }

  async healthCheck(): Promise<boolean> {
    try {
      const endpoint = this.buildEndpoint(this.generateSessionId());
      const proxyUrl = `http://${endpoint.username}:${endpoint.password}@${this.host}:${this.port}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);

      // route request through BrightData proxy to verify connectivity
      const res = await fetch('https://lumtest.com/myip.json', {
        signal: controller.signal,
        // @ts-expect-error -- undici dispatcher option supported in Node 22+
        dispatcher: await this.createProxyDispatcher(proxyUrl),
      });

      clearTimeout(timeout);
      return res.ok;
    } catch {
      return false;
    }
  }

  private async createProxyDispatcher(proxyUrl: string): Promise<unknown> {
    // dynamic import avoids hard dep; undici ships with Node 22
    const { ProxyAgent } = await import('undici');
    return new ProxyAgent(proxyUrl);
  }

  private buildEndpoint(sessionId: string, country?: string): ProxyEndpoint {
    const parts = [
      `brd-customer-${this.config.customer}`,
      `zone-${this.config.zone}`,
      `session-${sessionId}`,
    ];

    const targetCountry = country ?? this.config.country;
    if (targetCountry) {
      parts.push(`country-${targetCountry}`);
    }

    return {
      server: `http://${this.host}:${this.port}`,
      username: parts.join('-'),
      password: this.config.password,
    };
  }

  private generateSessionId(): string {
    return Math.random().toString(36).slice(2, 12);
  }
}
