import {
  CAPTCHAAI_SOLVABLE_KINDS,
  CAPTCHAAI_UNSUPPORTED_KINDS,
  captchaaiExtensionConfigSchema,
  solveCaptchaStepSchema,
} from '../data/schemas';

describe('captchaaiExtensionConfigSchema', () => {
  it('applies safe defaults for an empty config', () => {
    expect(captchaaiExtensionConfigSchema.parse({})).toEqual({
      detectOnNavigation: true,
      autoSolve: false,
      injectToken: true,
      recaptchaV3Action: 'verify',
      recaptchaV3MinScore: 0.3,
    });
  });

  it('rejects an out-of-range minimum score', () => {
    expect(captchaaiExtensionConfigSchema.safeParse({ recaptchaV3MinScore: 1.5 }).success).toBe(
      false,
    );
  });
});

describe('solveCaptchaStepSchema', () => {
  it('defaults the challenge type to auto', () => {
    const parsed = solveCaptchaStepSchema.parse({ action: 'solveCaptcha' });
    expect(parsed.type).toBe('auto');
  });

  it('accepts every solvable challenge family', () => {
    for (const type of CAPTCHAAI_SOLVABLE_KINDS) {
      expect(
        solveCaptchaStepSchema.safeParse({ action: 'solveCaptcha', type, sitekey: 'k' }).success,
      ).toBe(true);
    }
  });

  it('rejects challenge families CaptchaAI does not solve', () => {
    for (const type of CAPTCHAAI_UNSUPPORTED_KINDS) {
      expect(solveCaptchaStepSchema.safeParse({ action: 'solveCaptcha', type }).success).toBe(
        false,
      );
    }
  });

  it('rejects a step for another action', () => {
    expect(solveCaptchaStepSchema.safeParse({ action: 'click', selector: '#a' }).success).toBe(
      false,
    );
  });

  it('ignores the runtime step fields added by the step executor', () => {
    const parsed = solveCaptchaStepSchema.parse({
      index: 3,
      action: 'solveCaptcha',
      type: 'turnstile',
      sitekey: '0x4AAA',
      selector: undefined,
      value: undefined,
      condition: undefined,
    });

    expect(parsed).toEqual({ action: 'solveCaptcha', type: 'turnstile', sitekey: '0x4AAA' });
  });
});
