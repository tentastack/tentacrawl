import { detectCaptchas } from '../worker/captcha-detector';

describe('detectCaptchas', () => {
  it('detects a reCAPTCHA v2 checkbox widget and its sitekey', () => {
    const html = `
      <form>
        <div class="g-recaptcha" data-sitekey="6LcABC-key"></div>
        <script src="https://www.google.com/recaptcha/api.js"></script>
      </form>`;

    const detection = detectCaptchas(html);

    expect(detection.supported).toEqual([
      { kind: 'recaptcha-v2', sitekey: '6LcABC-key', invisible: false },
    ]);
    expect(detection.unsupported).toEqual([]);
  });

  it('flags invisible reCAPTCHA widgets', () => {
    const html = '<div class="g-recaptcha" data-sitekey="k1" data-size="invisible"></div>';

    expect(detectCaptchas(html).supported[0]).toMatchObject({
      kind: 'recaptcha-v2',
      sitekey: 'k1',
      invisible: true,
    });
  });

  it('detects score-based reCAPTCHA v3 from the render parameter', () => {
    const html = '<script src="https://www.google.com/recaptcha/api.js?render=v3-site-key"></script>';

    expect(detectCaptchas(html).supported).toEqual([
      { kind: 'recaptcha-v3', sitekey: 'v3-site-key', scoreBased: true },
    ]);
  });

  it('ignores the explicit render placeholder', () => {
    const html = '<script src="https://www.google.com/recaptcha/api.js?render=explicit"></script>';

    expect(detectCaptchas(html).supported).toEqual([]);
  });

  it('detects enterprise reCAPTCHA', () => {
    const html =
      '<script src="https://www.google.com/recaptcha/enterprise.js?render=ent-key"></script>';

    expect(detectCaptchas(html).supported).toEqual([
      { kind: 'recaptcha-enterprise', sitekey: 'ent-key', scoreBased: true },
    ]);
  });

  it('detects a Turnstile widget', () => {
    const html = `
      <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" defer></script>
      <div class="cf-turnstile" data-sitekey="0x4AAAAAAA" data-action="login"></div>`;

    expect(detectCaptchas(html).supported).toEqual([
      { kind: 'turnstile', sitekey: '0x4AAAAAAA', action: 'login' },
    ]);
  });

  it('reads a reCAPTCHA sitekey from the anchor iframe', () => {
    const html =
      '<iframe src="https://www.google.com/recaptcha/api2/anchor?ar=1&k=iframe-key&co=aHR0cA"></iframe>';

    expect(detectCaptchas(html).supported).toEqual([
      { kind: 'recaptcha-v2', sitekey: 'iframe-key' },
    ]);
  });

  it('reports hCaptcha as unsupported and never as solvable', () => {
    const html = `
      <div class="h-captcha" data-sitekey="hc-key"></div>
      <script src="https://js.hcaptcha.com/1/api.js"></script>`;

    const detection = detectCaptchas(html);

    expect(detection.supported).toEqual([]);
    expect(detection.unsupported).toEqual(['hcaptcha']);
  });

  it('reports FunCaptcha, GeeTest and DataDome as unsupported', () => {
    const detection = detectCaptchas(`
      <script src="https://client-api.arkoselabs.com/v2/api.js"></script>
      <script src="https://static.geetest.com/static/js/gt.0.5.0.js"></script>
      <script src="https://js.captcha-delivery.com/ddjs"></script>`);

    expect(detection.supported).toEqual([]);
    expect(detection.unsupported).toEqual(
      expect.arrayContaining(['funcaptcha', 'geetest', 'datadome']),
    );
  });

  it('returns nothing for a page without a captcha', () => {
    expect(detectCaptchas('<html><body><h1>hello</h1></body></html>')).toEqual({
      supported: [],
      unsupported: [],
    });
  });
});
