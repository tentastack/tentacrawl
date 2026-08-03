import {
  CAPTCHAAI_BASE_URL,
  CaptchaAIClient,
  CaptchaAIError,
  type CaptchaAIFetch,
  type CaptchaAIFetchInit,
} from '../captchaai.client';

interface Call {
  url: string;
  init?: CaptchaAIFetchInit;
}

function stubFetch(payloads: unknown[]): { fetchImpl: CaptchaAIFetch; calls: Call[] } {
  const calls: Call[] = [];
  const queue = [...payloads];
  const fetchImpl: CaptchaAIFetch = async (url, init) => {
    calls.push({ url, init });
    const body = queue.shift();
    return { ok: true, status: 200, json: async () => body };
  };
  return { fetchImpl, calls };
}

function makeClient(payloads: unknown[]) {
  const { fetchImpl, calls } = stubFetch(payloads);
  const client = new CaptchaAIClient({
    apiKey: 'test-key',
    fetchImpl,
    sleep: async () => undefined,
  });
  return { client, calls };
}

function submitParams(call: Call): URLSearchParams {
  return new URLSearchParams(call.init?.body ?? '');
}

const SOLVED = [{ status: 1, request: 'task-1' }, { status: 1, request: 'TOKEN' }];

describe('CaptchaAIClient', () => {
  it('submits reCAPTCHA v2 to ocr.captchaai.com/in.php and polls res.php', async () => {
    const { client, calls } = makeClient(SOLVED);

    const token = await client.solveRecaptchaV2({
      sitekey: '6Lc-key',
      pageurl: 'https://example.com/login',
      invisible: true,
    });

    expect(token).toBe('TOKEN');
    expect(calls[0].url).toBe(`${CAPTCHAAI_BASE_URL}/in.php`);
    expect(calls[0].init?.method).toBe('POST');
    const params = submitParams(calls[0]);
    expect(params.get('key')).toBe('test-key');
    expect(params.get('json')).toBe('1');
    expect(params.get('method')).toBe('userrecaptcha');
    expect(params.get('googlekey')).toBe('6Lc-key');
    expect(params.get('pageurl')).toBe('https://example.com/login');
    expect(params.get('invisible')).toBe('1');
    expect(params.get('enterprise')).toBeNull();

    const poll = new URL(calls[1].url);
    expect(poll.origin + poll.pathname).toBe(`${CAPTCHAAI_BASE_URL}/res.php`);
    expect(poll.searchParams.get('action')).toBe('get');
    expect(poll.searchParams.get('id')).toBe('task-1');
    expect(poll.searchParams.get('json')).toBe('1');
  });

  it('sends version, action and min_score for reCAPTCHA v3', async () => {
    const { client, calls } = makeClient(SOLVED);

    await client.solveRecaptchaV3({
      sitekey: 'v3-key',
      pageurl: 'https://example.com',
      action: 'login',
      minScore: 0.7,
    });

    const params = submitParams(calls[0]);
    expect(params.get('method')).toBe('userrecaptcha');
    expect(params.get('version')).toBe('v3');
    expect(params.get('action')).toBe('login');
    expect(params.get('min_score')).toBe('0.7');
    expect(params.get('googlekey')).toBe('v3-key');
  });

  it('adds enterprise=1 for enterprise challenges', async () => {
    const { client, calls } = makeClient(SOLVED);

    await client.solveRecaptchaV2({
      sitekey: 'ent-key',
      pageurl: 'https://example.com',
      enterprise: true,
    });

    expect(submitParams(calls[0]).get('enterprise')).toBe('1');
  });

  it('submits Turnstile with method=turnstile and sitekey', async () => {
    const { client, calls } = makeClient(SOLVED);

    await client.solveTurnstile({ sitekey: '0x4AAA', pageurl: 'https://example.com' });

    const params = submitParams(calls[0]);
    expect(params.get('method')).toBe('turnstile');
    expect(params.get('sitekey')).toBe('0x4AAA');
    expect(params.get('googlekey')).toBeNull();
  });

  it('submits image captchas as base64', async () => {
    const { client, calls } = makeClient([
      { status: 1, request: 'task-2' },
      { status: 1, request: 'ab12' },
    ]);

    const text = await client.solveImage({ body: 'aGVsbG8=' });

    expect(text).toBe('ab12');
    const params = submitParams(calls[0]);
    expect(params.get('method')).toBe('base64');
    expect(params.get('body')).toBe('aGVsbG8=');
  });

  it('keeps polling while the task is not ready', async () => {
    const { client, calls } = makeClient([
      { status: 1, request: 'task-3' },
      { status: 0, request: 'CAPCHA_NOT_READY' },
      { status: 0, request: 'CAPCHA_NOT_READY' },
      { status: 1, request: 'LATE_TOKEN' },
    ]);

    await expect(
      client.solveTurnstile({ sitekey: 'k', pageurl: 'https://example.com' }),
    ).resolves.toBe('LATE_TOKEN');
    expect(calls).toHaveLength(4);
  });

  it('throws when the submission is rejected', async () => {
    const { client } = makeClient([{ status: 0, request: 'ERROR_WRONG_USER_KEY' }]);

    await expect(
      client.solveRecaptchaV2({ sitekey: 'k', pageurl: 'https://example.com' }),
    ).rejects.toThrow(CaptchaAIError);
  });

  it('throws when solving fails after the task was accepted', async () => {
    const { client } = makeClient([
      { status: 1, request: 'task-4' },
      { status: 0, request: 'ERROR_CAPTCHA_UNSOLVABLE' },
    ]);

    await expect(
      client.solveRecaptchaV2({ sitekey: 'k', pageurl: 'https://example.com' }),
    ).rejects.toMatchObject({ code: 'ERROR_CAPTCHA_UNSOLVABLE' });
  });

  it('times out when the task never completes', async () => {
    const client = new CaptchaAIClient({
      apiKey: 'test-key',
      timeoutMs: 0,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ status: 1, request: 'task-5' }),
      }),
      sleep: async () => undefined,
    });

    await expect(
      client.solveRecaptchaV2({ sitekey: 'k', pageurl: 'https://example.com' }),
    ).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('reads the account balance', async () => {
    const { client, calls } = makeClient([{ status: 1, request: '12.34' }]);

    await expect(client.getBalance()).resolves.toBe(12.34);
    expect(new URL(calls[0].url).searchParams.get('action')).toBe('getbalance');
  });

  it('rejects unexpected payloads', async () => {
    const { client } = makeClient([{ unexpected: true }]);

    await expect(client.getBalance()).rejects.toThrow(CaptchaAIError);
  });
});
