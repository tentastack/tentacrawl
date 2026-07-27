import type { APIResponse, BrowserContext, Page, Response, Route } from 'playwright';
import type {
  ChallengerRequestInfo,
  ChallengerResponseInfo,
  ChallengerSessionSnapshot,
  ChallengerSource,
  ChallengerStepInfo,
} from '@tentacrawl/core';
import type { ChallengerRunSession } from './port/challenger-dispatcher';

const MAX_NAVIGATION_RETRIES = 2;

// prevents double-registering the route handler on a second page in the same context
const routedContexts = new WeakSet<BrowserContext>();

export interface ChallengerNavigationResult {
  response: Response | null;
  aborted?: { reason?: string };
}

export async function instrumentPage(
  page: Page,
  session: ChallengerRunSession | undefined,
  source: ChallengerSource,
): Promise<void> {
  if (!session) return;

  await session.dispatch('create-page', {
    source,
    raw: { page, context: page.context() },
  });

  if (session.hasHandlers('request')) {
    page.on('request', (request) => {
      void session
        .dispatch('request', {
          source,
          raw: { page, request },
          requestUrl: request.url(),
        })
        .catch(() => {});
    });
  }

  if (session.hasHandlers('response') || session.hasHandlers('redirect')) {
    page.on('response', (response) => {
      const redirectedFrom = response.request().redirectedFrom();
      if (session.hasHandlers('response')) {
        void session
          .dispatch('response', {
            source,
            raw: { page, response },
            responseUrl: response.url(),
            httpStatus: response.status(),
            redirectedFromUrl: redirectedFrom?.url(),
          })
          .catch(() => {});
      }
      if (session.hasHandlers('redirect') && response.status() >= 300 && response.status() < 400) {
        const location = response.headers()['location'];
        if (location) {
          void session
            .dispatch('redirect', {
              source,
              raw: { page, response },
              fromUrl: response.url(),
              toUrl: new URL(location, response.url()).toString(),
              status: response.status(),
            })
            .catch(() => {});
        }
      }
    });
  }

  if (session.hasRouteHandlers()) {
    await installInterception(page.context(), session);
  }
}

// fails open on any error; only pays the fetch-on-Node cost when a handler matches
async function installInterception(
  context: BrowserContext,
  session: ChallengerRunSession,
): Promise<void> {
  if (routedContexts.has(context)) return;
  routedContexts.add(context);

  await context.route('**/*', async (route: Route) => {
    const request = route.request();
    let info: ChallengerRequestInfo;
    try {
      info = {
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        headers: await request.allHeaders(),
        postData: request.postData() ?? undefined,
        isNavigationRequest: request.isNavigationRequest(),
      };
    } catch {
      await route.continue().catch(() => {});
      return;
    }

    let decision;
    try {
      decision = await session.routeRequest(info);
    } catch {
      decision = { action: 'continue' as const };
    }

    if (decision.action === 'abort') {
      await route.abort(decision.errorCode).catch(() => {});
      return;
    }
    if (decision.action === 'fulfill') {
      await route
        .fulfill({
          status: decision.response.status ?? 200,
          headers: decision.response.headers,
          contentType: decision.response.contentType,
          body: decision.response.body,
        })
        .catch(() => {});
      return;
    }

    // Playwright replaces the full header set, so merge over the originals.
    const override = decision.override;
    const continueOptions = override
      ? {
          url: override.url,
          method: override.method,
          headers: override.headers ? { ...info.headers, ...override.headers } : undefined,
          postData: override.postData,
        }
      : undefined;

    if (!session.responseInterceptionApplies(info)) {
      await route.continue(continueOptions).catch(() => {});
      return;
    }

    let fetched: APIResponse;
    try {
      fetched = await route.fetch(continueOptions);
    } catch {
      await route.continue(continueOptions).catch(() => {});
      return;
    }

    let result;
    try {
      result = await session.routeResponse(info, await buildResponseInfo(fetched, info));
    } catch {
      result = undefined;
    }

    try {
      await route.fulfill(
        result
          ? { response: fetched, status: result.status, headers: result.headers, body: result.body }
          : { response: fetched },
      );
    } catch {
      await route.fulfill({ response: fetched }).catch(() => {});
    }
  });
}

async function buildResponseInfo(
  fetched: APIResponse,
  request: ChallengerRequestInfo,
): Promise<ChallengerResponseInfo> {
  const headers = fetched.headers();
  const texty = isTextResponse(headers);
  let body: string | undefined;
  let isBinary = !texty;
  if (texty) {
    try {
      body = await fetched.text();
    } catch {
      isBinary = true;
    }
  }
  return {
    url: request.url,
    status: fetched.status(),
    headers,
    body,
    resourceType: request.resourceType,
    isBinary,
  };
}

function isTextResponse(headers: Record<string, string>): boolean {
  const contentType = headers['content-type'] ?? '';
  return /(^text\/|json|javascript|ecmascript|xml|html|css|svg|x-www-form-urlencoded)/i.test(
    contentType,
  );
}

export async function navigateWithChallenger(
  page: Page,
  url: string,
  options: { timeout?: number; waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' },
  session: ChallengerRunSession | undefined,
  source: ChallengerSource,
  step?: ChallengerStepInfo,
): Promise<ChallengerNavigationResult> {
  if (!session) {
    return { response: await page.goto(url, options) };
  }

  const before = await session.dispatch('before-navigation', {
    source,
    raw: { page },
    requestedUrl: url,
    waitUntil: options.waitUntil,
    step,
  });
  const beforeDecision = await applyPreNavigationOverride(before.navigationOverride);
  if (beforeDecision === 'abort') {
    return { response: null, aborted: { reason: before.navigationOverride?.reason } };
  }

  let attempt = 0;
  for (;;) {
    const response = await page.goto(url, options);

    const after = await session.dispatch('after-navigation', {
      source,
      raw: { page, response },
      requestedUrl: url,
      finalUrl: page.url(),
      waitUntil: options.waitUntil,
      httpStatus: response?.status(),
      step,
    });

    const override = after.navigationOverride;
    if (override?.action === 'abort') {
      return { response, aborted: { reason: override.reason } };
    }
    if (override?.action === 'delay' && override.delayMs && override.delayMs > 0) {
      await sleep(override.delayMs);
    }
    if (override?.action === 'retry' && attempt < MAX_NAVIGATION_RETRIES) {
      attempt += 1;
      continue;
    }

    await dispatchSessionSnapshot(page, session, source);
    return { response };
  }
}

export async function dispatchSessionSnapshot(
  page: Page,
  session: ChallengerRunSession | undefined,
  source: ChallengerSource,
): Promise<void> {
  if (!session?.hasHandlers('session-snapshot')) return;
  const snapshot = await captureSessionSnapshot(page);
  if (!snapshot) return;
  await session.dispatch('session-snapshot', {
    source,
    raw: { page },
    session: snapshot,
  });
}

export async function captureSessionSnapshot(
  page: Page,
): Promise<ChallengerSessionSnapshot | undefined> {
  try {
    const cookies = await page.context().cookies();
    const storage = await page.evaluate(() => {
      const read = (s: Storage) => {
        const out: Record<string, string> = {};
        for (let i = 0; i < s.length; i += 1) {
          const key = s.key(i);
          if (key !== null) out[key] = s.getItem(key) ?? '';
        }
        return out;
      };
      return {
        localStorage: read(window.localStorage),
        sessionStorage: read(window.sessionStorage),
      };
    });

    return {
      cookies: cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
      })),
      localStorage: storage.localStorage,
      sessionStorage: storage.sessionStorage,
      requestHeaders: {},
    };
  } catch {
    return undefined;
  }
}

async function applyPreNavigationOverride(
  override: { action: string; delayMs?: number } | undefined,
): Promise<'continue' | 'abort'> {
  if (!override) return 'continue';
  if (override.action === 'abort') return 'abort';
  if (override.action === 'delay' && override.delayMs && override.delayMs > 0) {
    await sleep(override.delayMs);
  }
  return 'continue';
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
