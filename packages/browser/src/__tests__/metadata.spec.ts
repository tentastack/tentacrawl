import { extractMetadata } from '../metadata';
import type { Page } from 'playwright';

function mockPage(evaluateResult: Record<string, unknown>): Page {
  return {
    evaluate: jest.fn().mockResolvedValue(evaluateResult),
  } as unknown as Page;
}

describe('extractMetadata', () => {
  it('returns metadata from page.evaluate', async () => {
    const meta = {
      title: 'Test Page',
      description: 'A test page',
      language: 'en',
      canonicalUrl: 'https://example.com/test',
      ogTitle: 'OG Test',
      ogDescription: 'OG Desc',
      ogImage: 'https://example.com/img.png',
      robots: 'index,follow',
    };
    const page = mockPage(meta);

    const result = await extractMetadata(page);

    expect(result.title).toBe('Test Page');
    expect(result.description).toBe('A test page');
    expect(result.language).toBe('en');
    expect(result.canonicalUrl).toBe('https://example.com/test');
    expect(result.ogTitle).toBe('OG Test');
    expect(result.ogDescription).toBe('OG Desc');
    expect(result.ogImage).toBe('https://example.com/img.png');
    expect(result.robots).toBe('index,follow');
    expect(page.evaluate).toHaveBeenCalledTimes(1);
  });

  it('handles missing metadata gracefully', async () => {
    const page = mockPage({});
    const result = await extractMetadata(page);
    expect(result.title).toBeUndefined();
    expect(result.description).toBeUndefined();
  });

  it('returns all defined PageMetadata fields', async () => {
    const full = {
      title: 'T',
      description: 'D',
      language: 'en',
      canonicalUrl: 'https://example.com',
      favicon: '/favicon.ico',
      ogTitle: 'OG T',
      ogDescription: 'OG D',
      ogImage: 'https://example.com/og.png',
      ogUrl: 'https://example.com',
      ogType: 'article',
      ogSiteName: 'Site',
      twitterCard: 'summary',
      twitterTitle: 'TW T',
      twitterDescription: 'TW D',
      twitterImage: 'https://example.com/tw.png',
      robots: 'index',
      author: 'Auth',
      publishedTime: '2024-01-01',
      modifiedTime: '2024-06-01',
    };
    const page = mockPage(full);
    const result = await extractMetadata(page);

    for (const [key, value] of Object.entries(full)) {
      expect(result[key as keyof typeof result]).toBe(value);
    }
  });
});
