import type { BrowserContext, Page } from 'playwright';
import type { ChallengerRawState, SessionStatePatch } from '@tentacrawl/core';

export async function applySessionStatePatch(
  raw: ChallengerRawState,
  patch: SessionStatePatch,
  baseUrl?: string,
): Promise<void> {
  const context = raw.context as BrowserContext | undefined;
  const page = raw.page as Page | undefined;

  if (context && patch.cookies?.length) {
    await context.addCookies(
      patch.cookies.map((cookie) => {
        if (cookie.domain) {
          return {
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path ?? '/',
          };
        }
        return {
          name: cookie.name,
          value: cookie.value,
          url: baseUrl ?? page?.url() ?? 'http://localhost',
        };
      }),
    );
  }

  if (context && patch.removeCookies?.length) {
    for (const name of patch.removeCookies) {
      await context.clearCookies({ name });
    }
  }

  if (context && patch.extraHeaders) {
    await context.setExtraHTTPHeaders(patch.extraHeaders);
  }

  if (page && (patch.localStorage || patch.sessionStorage)) {
    const applyStorage = (payload: {
      local?: Record<string, string>;
      session?: Record<string, string>;
    }) => {
      const win = globalThis as unknown as {
        localStorage: { setItem(k: string, v: string): void };
        sessionStorage: { setItem(k: string, v: string): void };
      };
      for (const [key, value] of Object.entries(payload.local ?? {})) {
        win.localStorage.setItem(key, value);
      }
      for (const [key, value] of Object.entries(payload.session ?? {})) {
        win.sessionStorage.setItem(key, value);
      }
    };
    await page.evaluate(applyStorage, {
      local: patch.localStorage,
      session: patch.sessionStorage,
    });
  }
}
