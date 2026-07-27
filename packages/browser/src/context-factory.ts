import type { BrowserContext, LaunchOptions } from 'playwright';
import {
  getStealthDefaults,
  buildAcceptLanguage,
  generateStealthSeed,
  getStealthInitScripts,
  type StealthDefaults,
} from './stealth';
import { DEFAULT_LOCALE, DEFAULT_TIMEZONE } from '@tentacrawl/core';
import type { ContextOptionsPatch } from '@tentacrawl/core';
import { getOrCreateBrowser, releaseReservation } from './browser-pool';
import type { ChallengerRunSession } from './port/challenger-dispatcher';

export interface ProxyConfig {
  server: string;
  username?: string;
  password?: string;
}

export interface ContextOptions {
  proxy?: ProxyConfig;
  stealth?: Partial<StealthDefaults>;
  locale?: string;
  timezone?: string;
  headers?: Record<string, string>;
  launchOptions?: LaunchOptions;
}

export async function createHardenedContext(
  options: ContextOptions = {},
  session?: ChallengerRunSession,
): Promise<{ context: BrowserContext; stealth: StealthDefaults }> {
  const resolved: ResolvedContextOptions = session
    ? await resolveChallengerOptions(options, session)
    : options;

  const browser = await getOrCreateBrowser(resolved.launchOptions);
  const stealth: StealthDefaults = {
    ...getStealthDefaults(),
    ...resolved.stealth,
  };

  const locale = resolved.locale ?? DEFAULT_LOCALE;
  const timezone = resolved.timezone ?? DEFAULT_TIMEZONE;

  let context: BrowserContext;
  try {
    context = await browser.newContext({
      userAgent: stealth.userAgent,
      viewport: stealth.viewport,
      locale,
      timezoneId: timezone,
      javaScriptEnabled: true,
      bypassCSP: true,
      extraHTTPHeaders: {
        'Accept-Language': buildAcceptLanguage(locale),
        ...resolved.headers,
      },
      ...(resolved.proxy
        ? {
            proxy: {
              server: resolved.proxy.server,
              username: resolved.proxy.username,
              password: resolved.proxy.password,
            },
          }
        : {}),
    });
  } finally {
    // context attached (or attempt failed); no longer needs eviction protection
    releaseReservation(browser);
  }

  const seed = generateStealthSeed(locale);
  const scripts = getStealthInitScripts(seed);
  for (const script of scripts) {
    await context.addInitScript(script.fn, script.arg);
  }

  for (const initScript of resolved.extensionInitScripts ?? []) {
    await context.addInitScript({ content: initScript.source });
  }

  if (session) {
    session.ctx.raw.browser = browser;
    session.ctx.raw.context = context;
  }

  return { context, stealth };
}

interface ResolvedContextOptions extends ContextOptions {
  extensionInitScripts?: Array<{ name: string; source: string }>;
}

async function resolveChallengerOptions(
  options: ContextOptions,
  session: ChallengerRunSession,
): Promise<ResolvedContextOptions> {
  const draft: ContextOptionsPatch = {
    proxy: options.proxy,
    stealth: options.stealth as Record<string, unknown> | undefined,
    locale: options.locale,
    timezone: options.timezone,
    headers: options.headers,
  };

  const result = await session.dispatch('bootstrap-context', {
    contextOptions: draft,
  });
  const patch = result.contextOptions;
  if (!patch) return options;

  const resolved: ResolvedContextOptions = { ...options };
  if (patch.proxy) {
    resolved.proxy = {
      server: patch.proxy.server,
      username: patch.proxy.username,
      password: patch.proxy.password,
    };
  }
  if (patch.stealth) {
    resolved.stealth = { ...options.stealth, ...patch.stealth } as Partial<StealthDefaults>;
  }
  if (patch.locale) resolved.locale = patch.locale;
  if (patch.timezone) resolved.timezone = patch.timezone;
  if (patch.headers) {
    resolved.headers = { ...options.headers, ...patch.headers };
  }
  if (patch.launchArgs?.length) {
    resolved.launchOptions = {
      ...options.launchOptions,
      args: [...(options.launchOptions?.args ?? []), ...patch.launchArgs],
    };
  }
  if (patch.initScripts?.length) {
    resolved.extensionInitScripts = patch.initScripts;
  }
  return resolved;
}
