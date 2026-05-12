import { parseDsl, compileDsl, parseAndCompile } from '../compiler';

const GENERIC_YAML = `
name: demo-basic
steps:
  - action: goto
    value: "https://example.com/search"
  - action: click
    selector: ".open-search"
  - action: fill
    selector: "#searchTerm"
    value: "{{searchTerm}}"
  - action: fill
    selector: "#categoryCode"
    value: "{{categoryCode}}"
  - action: fill
    selector: "#resultToken"
    value: "{{resultToken}}"
  - action: click
    selector: "#submitSearch"
  - action: click
    selector: ".export-results"
  - action: extract
    selector: "#results"
    outputKey: "page_main"
`;

describe('parseDsl', () => {
  it('parses the reference DSL YAML', () => {
    const doc = parseDsl(GENERIC_YAML);
    expect(doc.name).toBe('demo-basic');
    expect(doc.steps).toHaveLength(8);
    expect(doc.steps[0].action).toBe('goto');
    expect(doc.steps[7].outputKey).toBe('page_main');
  });

  it('throws on invalid YAML structure', () => {
    expect(() => parseDsl('not: a: valid: dsl')).toThrow();
  });

  it('throws on missing steps', () => {
    expect(() => parseDsl('name: empty\nsteps: []')).toThrow();
  });
});

describe('compileDsl', () => {
  it('resolves template variables', () => {
    const doc = parseDsl(GENERIC_YAML);
    const result = compileDsl(doc, {
      params: { searchTerm: 'maps', categoryCode: 'featured', resultToken: 'alpha-7' },
    });

    expect(result.steps).toHaveLength(8);
    expect(result.steps[2].value).toBe('maps');
    expect(result.steps[3].value).toBe('featured');
    expect(result.steps[4].value).toBe('alpha-7');
  });

  it('leaves unresolved vars intact', () => {
    const doc = parseDsl(GENERIC_YAML);
    const result = compileDsl(doc, { params: {} });
    expect(result.steps[2].value).toBe('{{searchTerm}}');
  });

  it('assigns sequential step indices', () => {
    const doc = parseDsl(GENERIC_YAML);
    const result = compileDsl(doc);
    result.steps.forEach((step, i) => {
      expect(step.index).toBe(i);
    });
  });

  it('compiles assert step with condition field', () => {
    const yamlWithAssert = `
name: test
steps:
  - action: goto
    value: "https://example.com"
  - action: assert
    selector: body
    condition: notContains
    value: "error message"
`;
    const result = parseAndCompile(yamlWithAssert);
    expect(result.steps[1].action).toBe('assert');
    expect(result.steps[1].condition).toBe('notContains');
    expect(result.steps[1].value).toBe('error message');
  });

  it('compiles wait and saveSource steps', () => {
    const yaml = `
name: test
steps:
  - action: goto
    value: "https://example.com"
  - action: wait
    value: "3000"
  - action: saveSource
    outputKey: full_page
`;
    const result = parseAndCompile(yaml);
    expect(result.steps[1].action).toBe('wait');
    expect(result.steps[1].value).toBe('3000');
    expect(result.steps[2].action).toBe('saveSource');
    expect(result.steps[2].outputKey).toBe('full_page');
  });
});

describe('parseAndCompile', () => {
  it('combines parse + compile in one call', () => {
    const result = parseAndCompile(GENERIC_YAML, {
      params: { searchTerm: 'logs', categoryCode: 'archive', resultToken: 'beta-3' },
    });
    expect(result.name).toBe('demo-basic');
    expect(result.steps[2].value).toBe('logs');
    expect(result.steps[7].outputKey).toBe('page_main');
  });
});
