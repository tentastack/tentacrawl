import type { Browser, BrowserContext, Page, Request, Response } from 'playwright';
import type { ChallengerRuntimeContext } from '@tentacrawl/core';

export function asPage(ctx: ChallengerRuntimeContext): Page | undefined {
  return ctx.raw.page as Page | undefined;
}

export function asContext(ctx: ChallengerRuntimeContext): BrowserContext | undefined {
  return ctx.raw.context as BrowserContext | undefined;
}

export function asBrowser(ctx: ChallengerRuntimeContext): Browser | undefined {
  return ctx.raw.browser as Browser | undefined;
}

export function asRequest(ctx: ChallengerRuntimeContext): Request | undefined {
  return ctx.raw.request as Request | undefined;
}

export function asResponse(ctx: ChallengerRuntimeContext): Response | undefined {
  return ctx.raw.response as Response | undefined;
}
