import { discoverLinks, normalizeDiscoveredUrl } from '../link-discovery';
import type { Page } from 'playwright';

function mockPage(rawLinks: { href: string; text: string }[]): Page {
  return {
    evaluate: jest.fn().mockResolvedValue(rawLinks),
  } as unknown as Page;
}

describe('discoverLinks', () => {
  const baseUrl = 'https://example.com/page';

  it('normalizes bare origins to a canonical root URL', () => {
    expect(normalizeDiscoveredUrl('https://example.com')).toBe('https://example.com/');
  });

  it('resolves relative URLs against baseUrl', async () => {
    const page = mockPage([
      { href: '/about', text: 'About' },
      { href: 'contact', text: 'Contact' },
    ]);

    const result = await discoverLinks(page, baseUrl);

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: 'https://example.com/about' }),
        expect.objectContaining({ url: 'https://example.com/contact' }),
      ]),
    );
  });

  it('classifies internal and external links', async () => {
    const page = mockPage([
      { href: 'https://example.com/about', text: 'About' },
      { href: 'https://other.com/page', text: 'Other' },
    ]);

    const result = await discoverLinks(page, baseUrl);

    const internal = result.find((l) => l.url === 'https://example.com/about');
    const external = result.find((l) => l.url === 'https://other.com/page');
    expect(internal?.isInternal).toBe(true);
    expect(external?.isInternal).toBe(false);
  });

  it('deduplicates URLs', async () => {
    const page = mockPage([
      { href: 'https://example.com/about', text: 'About 1' },
      { href: 'https://example.com/about', text: 'About 2' },
    ]);

    const result = await discoverLinks(page, baseUrl);
    const aboutLinks = result.filter((l) => l.url === 'https://example.com/about');
    expect(aboutLinks).toHaveLength(1);
  });

  it('strips URL fragments', async () => {
    const page = mockPage([
      { href: 'https://example.com/page#section1', text: 'Section 1' },
      { href: 'https://example.com/page#section2', text: 'Section 2' },
    ]);

    const result = await discoverLinks(page, baseUrl);
    const pageLinks = result.filter((l) => l.url === 'https://example.com/page');
    expect(pageLinks).toHaveLength(1);
  });

  it('preserves query parameters during normalization', () => {
    expect(normalizeDiscoveredUrl('https://example.com/path?__cf_chl_rt_tk=token&tab=Newest')).toBe(
      'https://example.com/path?__cf_chl_rt_tk=token&tab=Newest',
    );
  });

  it('deduplicates canonical root URLs', async () => {
    const page = mockPage([
      { href: 'https://example.com', text: 'Home 1' },
      { href: 'https://example.com/', text: 'Home 2' },
    ]);

    const result = await discoverLinks(page, 'https://example.com');
    const rootLinks = result.filter((l) => l.url === 'https://example.com/');
    expect(rootLinks).toHaveLength(1);
  });

  it('classifies absolute links against the final navigated origin', async () => {
    const page = mockPage([
      { href: 'https://www.example.com/about', text: 'About' },
      { href: 'https://example.com/contact', text: 'Legacy' },
    ]);

    const result = await discoverLinks(page, 'https://www.example.com/');

    expect(result.find((l) => l.url === 'https://www.example.com/about')?.isInternal).toBe(true);
    expect(result.find((l) => l.url === 'https://example.com/contact')?.isInternal).toBe(false);
  });

  it('keeps links that differ by query parameters when no hook normalizes them', async () => {
    const page = mockPage([
      { href: 'https://example.com/questions?tab=Newest', text: 'Questions' },
      { href: 'https://example.com/questions?tab=Newest&__cf_chl_rt_tk=token', text: 'Tokenized' },
    ]);

    const result = await discoverLinks(page, baseUrl);

    expect(result).toHaveLength(2);
  });

  it('skips non-http links (mailto, javascript, tel)', async () => {
    const page = mockPage([
      { href: 'mailto:test@example.com', text: 'Email' },
      { href: 'javascript:void(0)', text: 'JS' },
      { href: 'tel:+1234567890', text: 'Phone' },
      { href: 'https://example.com/real', text: 'Real' },
    ]);

    const result = await discoverLinks(page, baseUrl);
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://example.com/real');
  });

  it('skips truly invalid URLs gracefully', async () => {
    const page = mockPage([
      { href: 'https://example.com/good', text: 'Good' },
    ]);

    const result = await discoverLinks(page, baseUrl);
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://example.com/good');
  });

  it('returns empty array for no links', async () => {
    const page = mockPage([]);
    const result = await discoverLinks(page, baseUrl);
    expect(result).toEqual([]);
  });

  it('preserves link text', async () => {
    const page = mockPage([
      { href: 'https://example.com/page', text: 'Click Here' },
    ]);

    const result = await discoverLinks(page, baseUrl);
    expect(result[0].text).toBe('Click Here');
  });
});
