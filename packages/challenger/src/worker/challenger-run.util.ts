import type { ContextOptionsPatch } from '@tentacrawl/core';

export function mergeContextOptions(
  base: ContextOptionsPatch,
  patch: Partial<ContextOptionsPatch>,
): void {
  if (patch.proxy) base.proxy = patch.proxy;
  if (patch.locale) base.locale = patch.locale;
  if (patch.timezone) base.timezone = patch.timezone;
  if (patch.stealth) base.stealth = { ...base.stealth, ...patch.stealth };
  if (patch.headers) base.headers = { ...base.headers, ...patch.headers };
  if (patch.launchArgs) {
    base.launchArgs = [...(base.launchArgs ?? []), ...patch.launchArgs];
  }
  if (patch.initScripts) {
    base.initScripts = [...(base.initScripts ?? []), ...patch.initScripts];
  }
}

export function matchUrlPattern(pattern: string, url: string): boolean {
  try {
    return new RegExp(pattern).test(url);
  } catch {
    return url.includes(pattern);
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number | undefined,
  message: string,
): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) return promise;
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
