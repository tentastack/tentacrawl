import { z } from 'zod';
import { parseDsl, parseAndCompile } from '../compiler';
import { buildStepSchema, type DslActionContribution } from '../dsl.schema';

const solveCaptcha: DslActionContribution = {
  action: 'solveCaptcha',
  schema: z.object({
    action: z.literal('solveCaptcha'),
    selector: z.string(),
    vendor: z.string().optional(),
  }),
};

const CAPTCHA_YAML = `
name: captcha-flow
steps:
  - action: goto
    value: "https://example.com/login"
  - action: solveCaptcha
    selector: "#captcha"
    vendor: turnstile
  - action: extract
    selector: "#result"
    outputKey: data
`;

describe('DSL action contributions', () => {
  it('rejects unknown actions without contributions', () => {
    expect(() => parseDsl(CAPTCHA_YAML)).toThrow();
  });

  it('parses steps matching a contributed action schema', () => {
    const doc = parseDsl(CAPTCHA_YAML, [solveCaptcha]);
    expect(doc.steps).toHaveLength(3);
    expect(doc.steps[1].action).toBe('solveCaptcha');
  });

  it('still validates base steps strictly when contributions exist', () => {
    const invalid = `
name: bad
steps:
  - action: goto
`;
    expect(() => parseDsl(invalid, [solveCaptcha])).toThrow();
  });

  it('compiles contributed steps with raw fields and templates', () => {
    const result = parseAndCompile(CAPTCHA_YAML, { actions: [solveCaptcha] });
    const step = result.steps[1];
    expect(step.action).toBe('solveCaptcha');
    expect(step.selector).toBe('#captcha');
    expect(step.fields).toMatchObject({ vendor: 'turnstile' });
  });

  it('runs the contribution compile transform', () => {
    const withCompile: DslActionContribution = {
      ...solveCaptcha,
      compile: (step) => ({ ...(step as object), vendor: 'normalized' }),
    };
    const result = parseAndCompile(CAPTCHA_YAML, { actions: [withCompile] });
    expect(result.steps[1].fields).toMatchObject({ vendor: 'normalized' });
  });

  it('does not attach fields to base actions', () => {
    const result = parseAndCompile(CAPTCHA_YAML, { actions: [solveCaptcha] });
    expect(result.steps[0].fields).toBeUndefined();
    expect(result.steps[2].fields).toBeUndefined();
  });

  it('rejects contributions overriding base actions', () => {
    const override: DslActionContribution = {
      action: 'goto',
      schema: z.object({ action: z.literal('goto') }),
    };
    expect(() => buildStepSchema([override])).toThrow('overrides a base action');
  });
});
