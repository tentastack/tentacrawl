import type { Page } from 'playwright';
import type { PageMetadata } from '@tentacrawl/core';

export async function extractMetadata(page: Page): Promise<PageMetadata> {
  return page.evaluate(() => {
    const meta = (name: string): string | undefined => {
      const el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
      return el?.getAttribute('content') ?? undefined;
    };

    const link = (rel: string): string | undefined => {
      const el = document.querySelector(`link[rel="${rel}"]`);
      return el?.getAttribute('href') ?? undefined;
    };

    return {
      title: document.title || undefined,
      description: meta('description'),
      language: document.documentElement.lang || undefined,
      canonicalUrl: link('canonical'),
      favicon: link('icon') ?? link('shortcut icon'),
      ogTitle: meta('og:title'),
      ogDescription: meta('og:description'),
      ogImage: meta('og:image'),
      ogUrl: meta('og:url'),
      ogType: meta('og:type'),
      ogSiteName: meta('og:site_name'),
      twitterCard: meta('twitter:card'),
      twitterTitle: meta('twitter:title'),
      twitterDescription: meta('twitter:description'),
      twitterImage: meta('twitter:image'),
      robots: meta('robots'),
      author: meta('author'),
      publishedTime: meta('article:published_time'),
      modifiedTime: meta('article:modified_time'),
    };
  });
}
