import { dslDocumentSchema, dslStepSchema } from '../dsl.schema';

describe('dslStepSchema', () => {
  it('accepts valid goto step', () => {
    const step = dslStepSchema.parse({ action: 'goto', value: 'https://example.com' });
    expect(step.action).toBe('goto');
  });

  it('rejects goto without value', () => {
    expect(() => dslStepSchema.parse({ action: 'goto' })).toThrow();
  });

  it('accepts valid fill step', () => {
    const step = dslStepSchema.parse({
      action: 'fill',
      selector: '#input',
      value: 'text',
    });
    expect(step.action).toBe('fill');
  });

  it('rejects fill without selector', () => {
    expect(() =>
      dslStepSchema.parse({ action: 'fill', value: 'text' }),
    ).toThrow();
  });

  it('accepts extract step with selector and outputKey', () => {
    const step = dslStepSchema.parse({
      action: 'extract',
      selector: '#main',
      outputKey: 'page_main',
    });
    expect(step.outputKey).toBe('page_main');
  });

  it('rejects extract without outputKey', () => {
    expect(() =>
      dslStepSchema.parse({ action: 'extract', selector: '#main' }),
    ).toThrow();
  });

  it('accepts screenshot without outputKey', () => {
    const step = dslStepSchema.parse({ action: 'screenshot' });
    expect(step.action).toBe('screenshot');
  });

  it('accepts click with selector', () => {
    const step = dslStepSchema.parse({ action: 'click', selector: '#btn' });
    expect(step.selector).toBe('#btn');
  });

  it('rejects click without selector', () => {
    expect(() => dslStepSchema.parse({ action: 'click' })).toThrow();
  });

  it('rejects unknown action', () => {
    expect(() =>
      dslStepSchema.parse({ action: 'unknownAction' }),
    ).toThrow();
  });
});

describe('dslDocumentSchema', () => {
  it('accepts valid document', () => {
    const doc = dslDocumentSchema.parse({
      name: 'test-dsl',
      steps: [{ action: 'goto', value: 'https://example.com' }],
    });
    expect(doc.name).toBe('test-dsl');
    expect(doc.steps).toHaveLength(1);
  });

  it('rejects empty steps array', () => {
    expect(() =>
      dslDocumentSchema.parse({ name: 'empty', steps: [] }),
    ).toThrow();
  });

  it('rejects missing name', () => {
    expect(() =>
      dslDocumentSchema.parse({
        steps: [{ action: 'goto', value: 'https://example.com' }],
      }),
    ).toThrow();
  });
});

describe('new DSL actions', () => {
  it('accepts valid wait step', () => {
    const step = dslStepSchema.parse({ action: 'wait', value: '3000' });
    expect(step.action).toBe('wait');
  });

  it('rejects wait without value', () => {
    expect(() => dslStepSchema.parse({ action: 'wait' })).toThrow();
  });

  it('accepts valid saveSource step', () => {
    const step = dslStepSchema.parse({ action: 'saveSource', outputKey: 'page_html' });
    expect(step.action).toBe('saveSource');
    expect(step.outputKey).toBe('page_html');
  });

  it('rejects saveSource without outputKey', () => {
    expect(() => dslStepSchema.parse({ action: 'saveSource' })).toThrow();
  });

  it('accepts assert with contains condition', () => {
    const step = dslStepSchema.parse({
      action: 'assert',
      selector: 'body',
      condition: 'contains',
      value: 'expected text',
    });
    expect(step.condition).toBe('contains');
  });

  it('accepts assert with notContains condition', () => {
    const step = dslStepSchema.parse({
      action: 'assert',
      selector: 'body',
      condition: 'notContains',
      value: 'forbidden text',
    });
    expect(step.condition).toBe('notContains');
  });

  it('accepts assert with exists condition (no value needed)', () => {
    const step = dslStepSchema.parse({
      action: 'assert',
      selector: '#element',
      condition: 'exists',
    });
    expect(step.condition).toBe('exists');
  });

  it('accepts assert with notExists condition', () => {
    const step = dslStepSchema.parse({
      action: 'assert',
      selector: '#element',
      condition: 'notExists',
    });
    expect(step.condition).toBe('notExists');
  });

  it('rejects assert without selector', () => {
    expect(() =>
      dslStepSchema.parse({ action: 'assert', condition: 'exists' }),
    ).toThrow();
  });

  it('rejects assert without condition', () => {
    expect(() =>
      dslStepSchema.parse({ action: 'assert', selector: 'body' }),
    ).toThrow();
  });

  it('rejects assert contains without value', () => {
    expect(() =>
      dslStepSchema.parse({ action: 'assert', selector: 'body', condition: 'contains' }),
    ).toThrow();
  });

  it('rejects invalid condition', () => {
    expect(() =>
      dslStepSchema.parse({ action: 'assert', selector: 'body', condition: 'invalid' }),
    ).toThrow();
  });
});
