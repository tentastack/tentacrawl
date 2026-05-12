import { URL } from 'url';
import { getDomain, getHostname } from 'tldts';

export interface ParsedSiteOrigin {
  origin: string;
  hostname: string;
  scheme: string;
  robotsTxtUrl: string;
}

export function tryParseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function isHttpUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

export function extractUrlHostname(url: string): string {
  return getHostname(url, { allowPrivateDomains: true }) ?? url;
}

export function extractUrlPath(url: string): string {
  const parsed = tryParseUrl(url);
  if (!parsed) {
    return url;
  }

  const relativeUrl = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  return relativeUrl.length > 0 ? relativeUrl : '/';
}

export function parseSiteOrigin(url: string): ParsedSiteOrigin {
  const parsed = new URL(url);
  const originalHostname = getHostname(url, { allowPrivateDomains: true }) ?? parsed.hostname;
  const siteHostname = getDomain(url, { allowPrivateDomains: true }) ?? originalHostname;
  const normalizedHostname = siteHostname.toLowerCase();
  const normalizedOrigin = normalizedHostname === originalHostname.toLowerCase()
    ? parsed.origin
    : `${parsed.protocol}//${normalizedHostname}`;

  return {
    origin: normalizedOrigin,
    hostname: normalizedHostname,
    scheme: parsed.protocol.replace(':', ''),
    robotsTxtUrl: new URL('/robots.txt', normalizedOrigin).toString(),
  };
}

export function extractUrlOrigin(url: string): string {
  try {
    return parseSiteOrigin(url).origin;
  } catch {
    return url;
  }
}