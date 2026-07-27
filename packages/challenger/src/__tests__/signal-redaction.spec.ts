import { redactSensitive } from '../worker/challenger-signal.bus';

describe('redactSensitive', () => {
  it('redacts sensitive keys at any depth', () => {
    const input = {
      proxy: { server: 'http://p', password: 'secret', username: 'user' },
      cookies: [{ name: 'sid', value: 'xyz' }],
      note: 'safe',
      nested: { authorization: 'Bearer abc', plain: 1 },
    };
    const out = redactSensitive(input) as Record<string, unknown>;
    expect(out.proxy).toBe('[REDACTED]');
    expect(out.cookies).toBe('[REDACTED]');
    expect(out.note).toBe('safe');
    expect((out.nested as Record<string, unknown>).authorization).toBe('[REDACTED]');
    expect((out.nested as Record<string, unknown>).plain).toBe(1);
  });

  it('passes through primitives and null', () => {
    expect(redactSensitive('hello')).toBe('hello');
    expect(redactSensitive(null)).toBeNull();
    expect(redactSensitive(undefined)).toBeUndefined();
  });
});
