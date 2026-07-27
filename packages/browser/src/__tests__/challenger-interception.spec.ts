import type { Page } from 'playwright';
import type { ChallengerRunSession, RouteDecision } from '../port/challenger-dispatcher';
import { instrumentPage } from '../challenger-integration';

interface FakeRoute {
  continue: jest.Mock;
  abort: jest.Mock;
  fulfill: jest.Mock;
  fetch: jest.Mock;
  request: () => Record<string, unknown>;
}

function makeFakeRoute(): FakeRoute {
  return {
    continue: jest.fn().mockResolvedValue(undefined),
    abort: jest.fn().mockResolvedValue(undefined),
    fulfill: jest.fn().mockResolvedValue(undefined),
    fetch: jest.fn().mockResolvedValue(undefined),
    request: () => ({
      url: () => 'https://example.com/api',
      method: () => 'GET',
      resourceType: () => 'xhr',
      allHeaders: async () => ({ 'x-orig': '1' }),
      postData: () => null,
      isNavigationRequest: () => false,
    }),
  };
}

async function installAndCapture(decision: RouteDecision): Promise<FakeRoute> {
  let routeHandler: ((route: FakeRoute) => Promise<void>) | undefined;
  const context = {
    route: jest.fn(async (_pattern: string, handler: (route: FakeRoute) => Promise<void>) => {
      routeHandler = handler;
    }),
  };
  const page = { context: () => context } as unknown as Page;

  const session: Partial<ChallengerRunSession> = {
    dispatch: jest.fn().mockResolvedValue({}),
    hasHandlers: () => false,
    hasRouteHandlers: () => true,
    routeRequest: jest.fn().mockResolvedValue(decision),
    responseInterceptionApplies: () => false,
    routeResponse: jest.fn().mockResolvedValue(undefined),
  };

  await instrumentPage(page, session as ChallengerRunSession, 'scrape-simple');
  const route = makeFakeRoute();
  await routeHandler!(route);
  return route;
}

describe('installRequestInterception', () => {
  it('installs a single context route only when route handlers exist', async () => {
    const context = { route: jest.fn().mockResolvedValue(undefined) };
    const page = { context: () => context } as unknown as Page;
    const session: Partial<ChallengerRunSession> = {
      dispatch: jest.fn().mockResolvedValue({}),
      hasHandlers: () => false,
      hasRouteHandlers: () => false,
      routeRequest: jest.fn(),
      responseInterceptionApplies: () => false,
      routeResponse: jest.fn(),
    };
    await instrumentPage(page, session as ChallengerRunSession, 'scrape-simple');
    expect(context.route).not.toHaveBeenCalled();
  });

  it('maps a continue-with-override decision onto route.continue with merged headers', async () => {
    const route = await installAndCapture({
      action: 'continue',
      override: { headers: { 'x-new': 'v' } },
    });
    expect(route.continue).toHaveBeenCalledWith(
      expect.objectContaining({ headers: { 'x-orig': '1', 'x-new': 'v' } }),
    );
    expect(route.abort).not.toHaveBeenCalled();
  });

  it('maps an abort decision onto route.abort', async () => {
    const route = await installAndCapture({ action: 'abort', errorCode: 'blockedbyclient' });
    expect(route.abort).toHaveBeenCalledWith('blockedbyclient');
    expect(route.continue).not.toHaveBeenCalled();
  });

  it('maps a fulfill decision onto route.fulfill', async () => {
    const route = await installAndCapture({
      action: 'fulfill',
      response: { status: 204, body: 'stub' },
    });
    expect(route.fulfill).toHaveBeenCalledWith(
      expect.objectContaining({ status: 204, body: 'stub' }),
    );
  });

  it('continues without options when there is no override', async () => {
    const route = await installAndCapture({ action: 'continue' });
    expect(route.continue).toHaveBeenCalledWith(undefined);
  });

  it('fetches, transforms, and fulfills when response interception applies', async () => {
    let routeHandler: ((route: FakeRoute) => Promise<void>) | undefined;
    const context = {
      route: jest.fn(async (_pattern: string, handler: (route: FakeRoute) => Promise<void>) => {
        routeHandler = handler;
      }),
    };
    const page = { context: () => context } as unknown as Page;

    const fetched = {
      status: () => 200,
      headers: () => ({ 'content-type': 'text/html' }),
      text: async () => '<html>orig</html>',
    };

    const session: Partial<ChallengerRunSession> = {
      dispatch: jest.fn().mockResolvedValue({}),
      hasHandlers: () => false,
      hasRouteHandlers: () => true,
      routeRequest: jest.fn().mockResolvedValue({ action: 'continue' }),
      responseInterceptionApplies: () => true,
      routeResponse: jest.fn().mockResolvedValue({
        status: 200,
        headers: { 'content-type': 'text/html' },
        body: '<html>patched</html>',
      }),
    };

    await instrumentPage(page, session as ChallengerRunSession, 'scrape-simple');
    const route = makeFakeRoute();
    route.fetch = jest.fn().mockResolvedValue(fetched);
    await routeHandler!(route);

    expect(route.fetch).toHaveBeenCalled();
    expect(session.routeResponse).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://example.com/api' }),
      expect.objectContaining({ body: '<html>orig</html>', isBinary: false }),
    );
    expect(route.fulfill).toHaveBeenCalledWith(
      expect.objectContaining({ response: fetched, body: '<html>patched</html>' }),
    );
    expect(route.continue).not.toHaveBeenCalled();
  });
});
