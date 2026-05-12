export interface ProxyEndpoint {
  server: string;
  username?: string;
  password?: string;
}

export interface ProxySession {
  sessionId: string;
  endpoint: ProxyEndpoint;
  createdAt: Date;
}

export interface ProxyProvider {
  readonly name: string;
  acquireSession(options?: AcquireOptions): Promise<ProxySession>;
  releaseSession(sessionId: string): Promise<void>;
  healthCheck(): Promise<boolean>;
}

export interface ProxyProviderFactory {
  fromPoolConfig(raw: Record<string, unknown>): ProxyProvider;
}

export interface AcquireOptions {
  country?: string;
  sticky?: boolean;
}
