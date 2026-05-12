import { htmlToMarkdown } from '../markdown';

describe('htmlToMarkdown', () => {
  it('converts basic HTML to markdown', () => {
    const html = '<h1>Hello</h1><p>World</p>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('# Hello');
    expect(md).toContain('World');
  });

  it('converts links', () => {
    const html = '<a href="https://example.com">Click here</a>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('[Click here](https://example.com)');
  });

  it('converts lists', () => {
    const html = '<ul><li>One</li><li>Two</li></ul>';
    const md = htmlToMarkdown(html);
    expect(md).toMatch(/-\s+One/);
    expect(md).toMatch(/-\s+Two/);
  });

  it('strips script tags', () => {
    const html = '<p>Keep</p><script>alert("evil")</script><p>Also keep</p>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('Keep');
    expect(md).toContain('Also keep');
    expect(md).not.toContain('alert');
    expect(md).not.toContain('script');
  });

  it('strips style tags', () => {
    const html = '<style>.foo { color: red; }</style><p>Content</p>';
    const md = htmlToMarkdown(html);
    expect(md).not.toContain('color');
    expect(md).toContain('Content');
  });

  it('strips noscript tags', () => {
    const html = '<noscript>Enable JS</noscript><p>Content</p>';
    const md = htmlToMarkdown(html);
    expect(md).not.toContain('Enable JS');
    expect(md).toContain('Content');
  });

  it('strips SVG elements', () => {
    const html = '<svg><circle cx="50" cy="50" r="40"/></svg><p>After SVG</p>';
    const md = htmlToMarkdown(html);
    expect(md).not.toContain('circle');
    expect(md).toContain('After SVG');
  });

  it('collapses excessive blank lines', () => {
    const html = '<p>A</p><br><br><br><br><br><p>B</p>';
    const md = htmlToMarkdown(html);
    // should not have more than 2 consecutive newlines
    expect(md).not.toMatch(/\n{3,}/);
  });

  it('trims leading and trailing whitespace', () => {
    const html = '  <p>Content</p>  ';
    const md = htmlToMarkdown(html);
    expect(md).toBe(md.trim());
  });

  it('handles fenced code blocks', () => {
    const html = '<pre><code>const x = 1;</code></pre>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('```');
    expect(md).toContain('const x = 1;');
  });

  it('uses ATX headings', () => {
    const html = '<h2>Sub heading</h2><h3>Sub sub</h3>';
    const md = htmlToMarkdown(html);
    expect(md).toContain('## Sub heading');
    expect(md).toContain('### Sub sub');
  });

  it('returns empty string for empty input', () => {
    expect(htmlToMarkdown('')).toBe('');
  });
});
