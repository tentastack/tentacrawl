import type { CaptchaaiSolvableKind, CaptchaaiUnsupportedKind } from '../data/schemas';

export type DetectedChallengeKind = Exclude<CaptchaaiSolvableKind, 'image'>;

export interface DetectedChallenge {
  kind: DetectedChallengeKind;
  sitekey?: string;
  invisible?: boolean;
  action?: string;
  // score-based reCAPTCHA (loaded with `?render=<sitekey>`) rather than a
  // checkbox widget; enterprise challenges need version=v3 in that case
  scoreBased?: boolean;
}

export interface CaptchaDetection {
  supported: DetectedChallenge[];
  unsupported: CaptchaaiUnsupportedKind[];
}

const SITEKEY_TAG = /<[a-zA-Z][^>]*?sitekey[^>]*>/gi;
const RECAPTCHA_V3_RENDER = /recaptcha\/api\.js\?[^"'\s>]*render=([\w-]+)/i;
const RECAPTCHA_ENTERPRISE_RENDER = /recaptcha\/enterprise\.js\?[^"'\s>]*render=([\w-]+)/i;
const RECAPTCHA_ANCHOR_KEY = /recaptcha\/(?:api2|enterprise)\/anchor\?[^"'\s>]*[&?]k=([\w-]+)/i;
const TURNSTILE_SCRIPT = /challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/i;

const UNSUPPORTED_MARKERS: Array<{ kind: CaptchaaiUnsupportedKind; pattern: RegExp }> = [
  { kind: 'hcaptcha', pattern: /hcaptcha\.com\/1\/api\.js|class="[^"]*\bh-captcha\b|data-hcaptcha-sitekey/i },
  { kind: 'funcaptcha', pattern: /arkoselabs\.com|funcaptcha/i },
  { kind: 'geetest', pattern: /geetest\.com|geetest_challenge|initGeetest/i },
  { kind: 'datadome', pattern: /captcha-delivery\.com|datadome/i },
];

function attribute(tag: string, name: string): string | undefined {
  const match = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag);
  return match?.[1];
}

function hasClass(tag: string, className: string): boolean {
  const classes = attribute(tag, 'class');
  if (!classes) return false;
  return classes.split(/\s+/).includes(className);
}

function add(target: DetectedChallenge[], challenge: DetectedChallenge): void {
  const duplicate = target.some(
    (existing) => existing.kind === challenge.kind && existing.sitekey === challenge.sitekey,
  );
  if (!duplicate) target.push(challenge);
}

// Heuristic detection over the rendered HTML. Returns every challenge family
// found so the caller can decide what to solve and what to report as
// unsupported; it never guesses a sitekey it did not read from the page.
export function detectCaptchas(html: string): CaptchaDetection {
  const supported: DetectedChallenge[] = [];
  const unsupported: CaptchaaiUnsupportedKind[] = [];

  const enterprise = RECAPTCHA_ENTERPRISE_RENDER.test(html) || /recaptcha\/enterprise/i.test(html);

  for (const match of html.matchAll(SITEKEY_TAG)) {
    const tag = match[0];
    if (hasClass(tag, 'h-captcha') || attribute(tag, 'data-hcaptcha-sitekey')) continue;

    const sitekey = attribute(tag, 'data-sitekey');
    if (!sitekey) continue;

    if (hasClass(tag, 'cf-turnstile')) {
      add(supported, {
        kind: 'turnstile',
        sitekey,
        action: attribute(tag, 'data-action'),
      });
      continue;
    }

    if (hasClass(tag, 'g-recaptcha') || hasClass(tag, 'grecaptcha-badge')) {
      add(supported, {
        kind: enterprise ? 'recaptcha-enterprise' : 'recaptcha-v2',
        sitekey,
        invisible: attribute(tag, 'data-size') === 'invisible',
      });
      continue;
    }

    if (TURNSTILE_SCRIPT.test(html)) {
      add(supported, { kind: 'turnstile', sitekey });
    }
  }

  const enterpriseRender = RECAPTCHA_ENTERPRISE_RENDER.exec(html);
  if (enterpriseRender) {
    add(supported, {
      kind: 'recaptcha-enterprise',
      sitekey: enterpriseRender[1],
      scoreBased: true,
    });
  }

  const v3Render = RECAPTCHA_V3_RENDER.exec(html);
  if (v3Render && !['explicit', 'onload'].includes(v3Render[1])) {
    add(supported, {
      kind: enterprise ? 'recaptcha-enterprise' : 'recaptcha-v3',
      sitekey: v3Render[1],
      scoreBased: true,
    });
  }

  const anchorKey = RECAPTCHA_ANCHOR_KEY.exec(html);
  if (anchorKey) {
    add(supported, {
      kind: enterprise ? 'recaptcha-enterprise' : 'recaptcha-v2',
      sitekey: anchorKey[1],
    });
  }

  for (const marker of UNSUPPORTED_MARKERS) {
    if (marker.pattern.test(html) && !unsupported.includes(marker.kind)) {
      unsupported.push(marker.kind);
    }
  }

  return { supported, unsupported };
}
