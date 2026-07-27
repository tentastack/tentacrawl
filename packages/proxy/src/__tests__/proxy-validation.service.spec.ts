import { ProxyValidationService } from '../api/proxy-validation.service';

const closeMock = jest.fn(async () => undefined);
const proxyAgentMock = jest.fn().mockImplementation((opts: unknown) => ({ opts, close: closeMock }));
const fetchMock = jest.fn();

jest.mock('undici', () => ({
  ProxyAgent: jest.fn().mockImplementation((opts: unknown) => proxyAgentMock(opts)),
  fetch: (...args: unknown[]) => fetchMock(...args),
}));

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe('ProxyValidationService', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    proxyAgentMock.mockClear();
    closeMock.mockClear();
  });

  it('returns details on a successful proxied request', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { ip: '1.2.3.4', city: 'Warsaw', region: 'Mazovia', country: 'PL', org: 'AS1234 Example' }),
    );
    const service = new ProxyValidationService();

    const result = await service.test({ url: 'gw1.example:8080', username: 'u', password: 'p' });

    expect(result.ok).toBe(true);
    expect(result.details).toMatchObject({ ip: '1.2.3.4', city: 'Warsaw', country: 'PL' });
    expect(typeof result.details?.latencyMs).toBe('number');
    expect(closeMock).toHaveBeenCalled();
  });

  it('normalizes a scheme-less host:port into an http proxy uri and sets basic auth', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ip: '1.2.3.4' }));
    const service = new ProxyValidationService();

    await service.test({ url: 'gw1.example:8080', username: 'u', password: 'p' });

    expect(proxyAgentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        uri: 'http://gw1.example:8080',
        token: `Basic ${Buffer.from('u:p').toString('base64')}`,
      }),
    );
  });

  it('reports non-2xx proxy responses as failures', async () => {
    fetchMock.mockResolvedValue(jsonResponse(407, {}));
    const service = new ProxyValidationService();

    const result = await service.test({ url: 'http://gw1.example:8080' });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/407/);
  });

  it('maps connection errors to a friendly message', async () => {
    fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED 1.2.3.4:8080'));
    const service = new ProxyValidationService();

    const result = await service.test({ url: 'http://gw1.example:8080' });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Connection refused by the proxy host');
  });

  it('unwraps undici\'s nested cause chain to find the real proxy CONNECT failure', async () => {
    // matches undici's actual shape: TypeError('fetch failed') -> DOMException('Request
    // was cancelled.') -> RequestAbortedError with the real reason two levels down
    const requestAborted = new Error('Proxy response (407) !== 200 when HTTP Tunneling');
    const cancelled = new Error('Request was cancelled.', { cause: requestAborted });
    const fetchFailed = new TypeError('fetch failed', { cause: cancelled });
    fetchMock.mockRejectedValue(fetchFailed);
    const service = new ProxyValidationService();

    const result = await service.test({ url: 'http://gw1.example:8080', username: 'bad-user' });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Proxy rejected the credentials (407 Proxy Authentication Required)');
  });

  it('falls back to the deepest cause message when no known pattern matches', async () => {
    const inner = new Error('Proxy response (503) !== 200 when HTTP Tunneling');
    const cancelled = new Error('Request was cancelled.', { cause: inner });
    fetchMock.mockRejectedValue(new TypeError('fetch failed', { cause: cancelled }));
    const service = new ProxyValidationService();

    const result = await service.test({ url: 'http://gw1.example:8080' });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Proxy response (503) !== 200 when HTTP Tunneling');
  });

  it('refuses to test socks5 endpoints without making a request', async () => {
    const service = new ProxyValidationService();

    const result = await service.test({ url: 'socks5://gw1.example:1080' });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/SOCKS5/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
