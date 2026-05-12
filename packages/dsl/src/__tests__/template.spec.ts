import { renderTemplate } from '../template';

describe('renderTemplate', () => {
  it('replaces simple variables', () => {
    expect(renderTemplate('Hello {{name}}', { name: 'World' })).toBe(
      'Hello World',
    );
  });

  it('replaces multiple occurrences', () => {
    expect(
      renderTemplate('{{a}} and {{b}}', { a: '1', b: '2' }),
    ).toBe('1 and 2');
  });

  it('leaves unresolved placeholders intact', () => {
    expect(renderTemplate('{{missing}}', {})).toBe('{{missing}}');
  });

  it('handles whitespace inside braces', () => {
    expect(renderTemplate('{{ spaced }}', { spaced: 'ok' })).toBe('ok');
  });

  it('coerces non-string values', () => {
    expect(renderTemplate('num={{n}}', { n: 42 })).toBe('num=42');
  });

  it('returns original string when no placeholders', () => {
    expect(renderTemplate('no vars', {})).toBe('no vars');
  });
});
