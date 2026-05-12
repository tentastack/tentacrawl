import { collectArtefacts } from '../format-pipeline';
import type { Page } from 'playwright';
import type { ArtefactFormat } from '@tentacrawl/core';

// mock the sub-modules
jest.mock('../markdown', () => ({
  htmlToMarkdown: jest.fn((html: string) => `# Mocked\n\n${html.slice(0, 20)}`),
}));
jest.mock('../metadata', () => ({
  extractMetadata: jest.fn().mockResolvedValue({ title: 'Mock Title' }),
}));
jest.mock('../link-discovery', () => ({
  discoverLinks: jest.fn().mockResolvedValue([
    { url: 'https://example.com/about', text: 'About', isInternal: true },
  ]),
}));

function mockPage(html = '<html><body>Hello</body></html>'): Page {
  return {
    content: jest.fn().mockResolvedValue(html),
    screenshot: jest.fn().mockResolvedValue(Buffer.from('fake-screenshot')),
  } as unknown as Page;
}

describe('collectArtefacts', () => {
  const baseUrl = 'https://example.com';

  it('returns html when requested', async () => {
    const page = mockPage('<html><body>Test</body></html>');
    const result = await collectArtefacts(page, ['html'], baseUrl);
    expect(result.html).toBe('<html><body>Test</body></html>');
    expect(page.content).toHaveBeenCalled();
  });

  it('returns markdown when requested', async () => {
    const page = mockPage('<html><body>Test</body></html>');
    const result = await collectArtefacts(page, ['markdown'], baseUrl);
    expect(result.markdown).toBeDefined();
    expect(result.markdown).toContain('# Mocked');
  });

  it('fetches html for markdown even if html not requested', async () => {
    const page = mockPage();
    const result = await collectArtefacts(page, ['markdown'], baseUrl);
    expect(page.content).toHaveBeenCalled();
    // html not in result since not explicitly requested
    expect(result.html).toBeUndefined();
    expect(result.markdown).toBeDefined();
  });

  it('returns metadata when requested', async () => {
    const page = mockPage();
    const result = await collectArtefacts(page, ['metadata'], baseUrl);
    expect(result.metadata).toEqual({ title: 'Mock Title' });
  });

  it('returns links when requested', async () => {
    const page = mockPage();
    const result = await collectArtefacts(page, ['links'], baseUrl);
    expect(result.links).toHaveLength(1);
    expect(result.links![0].url).toBe('https://example.com/about');
  });

  it('returns screenshot as base64 when requested', async () => {
    const page = mockPage();
    const result = await collectArtefacts(page, ['screenshot'], baseUrl);
    expect(result.screenshot).toBe(Buffer.from('fake-screenshot').toString('base64'));
    expect(page.screenshot).toHaveBeenCalledWith({ fullPage: true });
  });

  it('returns multiple artefacts simultaneously', async () => {
    const page = mockPage('<html><body>Multi</body></html>');
    const artefacts: ArtefactFormat[] = ['html', 'markdown', 'metadata', 'links', 'screenshot'];
    const result = await collectArtefacts(page, artefacts, baseUrl);

    expect(result.html).toBeDefined();
    expect(result.markdown).toBeDefined();
    expect(result.metadata).toBeDefined();
    expect(result.links).toBeDefined();
    expect(result.screenshot).toBeDefined();
  });

  it('returns empty result when no artefacts requested', async () => {
    const page = mockPage();
    const result = await collectArtefacts(page, [], baseUrl);
    expect(result).toEqual({});
    expect(page.content).not.toHaveBeenCalled();
    expect(page.screenshot).not.toHaveBeenCalled();
  });

  it('does not call page.content if only metadata/links artefacts are requested', async () => {
    const page = mockPage();
    await collectArtefacts(page, ['metadata', 'links'], baseUrl);
    expect(page.content).not.toHaveBeenCalled();
  });
});
