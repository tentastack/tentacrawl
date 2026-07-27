import { chromium, type Browser, type LaunchOptions } from 'playwright';

// merged with any extension launchArgs, never replaced
const DEFAULT_LAUNCH_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--disable-features=IsolateOrigins,site-per-process',
  '--no-sandbox',
];

const DEFAULT_POOL_MAX = 4;

interface PooledEntry {
  browser: Browser;
  lastUsedAt: number;
  // callers holding this browser with no context attached yet
  reservations: number;
}

// keyed by launch profile: distinct args/proxy get a distinct browser process
const pool = new Map<string, PooledEntry>();

function poolMax(): number {
  const raw = Number(process.env.BROWSER_POOL_MAX);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_POOL_MAX;
}

function resolveArgs(extraArgs?: string[]): string[] {
  const merged = [...DEFAULT_LAUNCH_ARGS];
  for (const arg of extraArgs ?? []) {
    if (!merged.includes(arg)) merged.push(arg);
  }
  return merged;
}

function launchProfileKey(args: string[], options: Omit<LaunchOptions, 'args'>): string {
  return JSON.stringify({
    args: [...args].sort(),
    headless: options.headless ?? true,
    channel: options.channel ?? null,
    executablePath: options.executablePath ?? null,
    proxyServer: options.proxy?.server ?? null,
  });
}

// caller must releaseReservation(browser) once a context is attached
export async function getOrCreateBrowser(options: LaunchOptions = {}): Promise<Browser> {
  const { args: extraArgs, ...rest } = options;
  const args = resolveArgs(extraArgs);
  const key = launchProfileKey(args, rest);

  const existing = pool.get(key);
  if (existing && existing.browser.isConnected()) {
    existing.lastUsedAt = Date.now();
    existing.reservations += 1;
    return existing.browser;
  }
  if (existing) pool.delete(key);

  const browser = await chromium.launch({ headless: true, ...rest, args });
  browser.on('disconnected', () => {
    const current = pool.get(key);
    if (current && current.browser === browser) pool.delete(key);
  });
  pool.set(key, { browser, lastUsedAt: Date.now(), reservations: 1 });
  await evictIdle(key);
  return browser;
}

export function releaseReservation(browser: Browser): void {
  for (const entry of pool.values()) {
    if (entry.browser === browser) {
      if (entry.reservations > 0) entry.reservations -= 1;
      return;
    }
  }
}

// over the cap: close LRU browsers with no open contexts and no reservations
async function evictIdle(keepKey: string): Promise<void> {
  const max = poolMax();
  if (pool.size <= max) return;

  const candidates = [...pool.entries()]
    .filter(([key]) => key !== keepKey)
    .sort((a, b) => a[1].lastUsedAt - b[1].lastUsedAt);

  for (const [key, entry] of candidates) {
    if (pool.size <= max) break;
    if (entry.reservations > 0) continue;
    if (hasOpenContexts(entry.browser)) continue;
    pool.delete(key);
    await entry.browser.close().catch(() => undefined);
  }
}

function hasOpenContexts(browser: Browser): boolean {
  try {
    return typeof browser.contexts === 'function' && browser.contexts().length > 0;
  } catch {
    return false;
  }
}

export async function closeBrowser(): Promise<void> {
  const entries = [...pool.values()];
  pool.clear();
  await Promise.all(entries.map((entry) => entry.browser.close().catch(() => undefined)));
}

export function browserPoolSize(): number {
  return pool.size;
}
