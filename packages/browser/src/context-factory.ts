import type { Browser, BrowserContext, LaunchOptions } from 'playwright';
import { chromium } from 'playwright';
import {
  getStealthDefaults,
  buildAcceptLanguage,
  generateStealthSeed,
  getStealthInitScripts,
  type StealthDefaults,
} from './stealth';
import { DEFAULT_LOCALE, DEFAULT_TIMEZONE } from '@tentacrawl/core';

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

let sharedBrowser: Browser | undefined;

export async function getOrCreateBrowser(
  launchOptions?: LaunchOptions,
): Promise<Browser> {
  if (!sharedBrowser || !sharedBrowser.isConnected()) {
    sharedBrowser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--no-sandbox',
      ],
      ...launchOptions,
    });
  }
  return sharedBrowser;
}

export async function createHardenedContext(
  options: ContextOptions = {},
): Promise<{ context: BrowserContext; stealth: StealthDefaults }> {
  const browser = await getOrCreateBrowser(options.launchOptions);
  const stealth: StealthDefaults = {
    ...getStealthDefaults(),
    ...options.stealth,
  };

  const locale = options.locale ?? DEFAULT_LOCALE;
  const timezone = options.timezone ?? DEFAULT_TIMEZONE;

  const context = await browser.newContext({
    userAgent: stealth.userAgent,
    viewport: stealth.viewport,
    locale,
    timezoneId: timezone,
    javaScriptEnabled: true,
    bypassCSP: true,
    extraHTTPHeaders: {
      'Accept-Language': buildAcceptLanguage(locale),
      ...options.headers,
    },
    ...(options.proxy
      ? {
          proxy: {
            server: options.proxy.server,
            username: options.proxy.username,
            password: options.proxy.password,
          },
        }
      : {}),
  });

  const seed = generateStealthSeed(locale);
  const scripts = getStealthInitScripts(seed);
  for (const script of scripts) {
    await context.addInitScript(script.fn, script.arg);
  }

  return { context, stealth };
}

export async function closeBrowser(): Promise<void> {
  if (sharedBrowser?.isConnected()) {
    await sharedBrowser.close();
    sharedBrowser = undefined;
  }
}
