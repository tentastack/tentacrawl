import type { Page } from 'playwright';
import type { PageLink } from '@tentacrawl/core';
import type { ChallengerRunSession } from './port/challenger-dispatcher';

export function normalizeDiscoveredUrl(url: string): string | null {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  parsed.hash = '';

  if ((parsed.protocol === 'http:' && parsed.port === '80') || (parsed.protocol === 'https:' && parsed.port === '443')) {
    parsed.port = '';
  }

  if (parsed.pathname.length === 0) {
    parsed.pathname = '/';
  }

  return parsed.toString();
}

export async function discoverLinks(
  page: Page,
  baseUrl: string,
  session?: ChallengerRunSession,
): Promise<PageLink[]> {
  const normalizedBaseUrl = normalizeDiscoveredUrl(baseUrl);
  const baseReferenceUrl = normalizedBaseUrl ?? new URL(baseUrl).toString();
  const baseOrigin = new URL(baseReferenceUrl).origin;

  const rawLinks: { href: string; text: string }[] = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'));
    return anchors
      .map((a: HTMLAnchorElement) => ({
        href: a.getAttribute('href') ?? '',
        text: (a.textContent ?? '').trim().slice(0, 200),
      }))
      .filter((l) => l.href.length > 0);
  });

  const links: PageLink[] = [];
  const seen = new Set<string>();

  for (const raw of rawLinks) {
    let resolved: string | null;

    try {
      resolved = normalizeDiscoveredUrl(new URL(raw.href, baseReferenceUrl).toString());
    } catch {
      continue;
    }

    if (!resolved) continue;
    if (seen.has(resolved)) continue;
    seen.add(resolved);

    const link: PageLink = {
      url: resolved,
      text: raw.text,
      isInternal: new URL(resolved).origin === baseOrigin,
    };

    if (session?.hasHandlers('discovered-link')) {
      const result = await session.dispatch('discovered-link', {
        raw: { page },
        link,
      });
      if (result.dropLink) continue;
    }

    links.push(link);
  }

  return links;
}
