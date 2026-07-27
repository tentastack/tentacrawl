jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn(async () => ({
      isConnected: () => true,
      newContext: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
      on: jest.fn().mockReturnThis(),
      contexts: jest.fn().mockReturnValue([]),
    })),
  },
}));

import { chromium } from 'playwright';
import {
  getOrCreateBrowser,
  releaseReservation,
  closeBrowser,
  browserPoolSize,
} from '../browser-pool';

describe('browser pool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    delete process.env.BROWSER_POOL_MAX;
    await closeBrowser();
  });

  it('reuses one browser for the same launch profile', async () => {
    const a = await getOrCreateBrowser();
    const b = await getOrCreateBrowser();
    expect(a).toBe(b);
    expect(chromium.launch).toHaveBeenCalledTimes(1);
    expect(browserPoolSize()).toBe(1);
  });

  it('launches a distinct browser per distinct launchArgs (process-level isolation)', async () => {
    const a = await getOrCreateBrowser();
    const b = await getOrCreateBrowser({ args: ['--proxy-bypass-list=*'] });
    expect(a).not.toBe(b);
    expect(chromium.launch).toHaveBeenCalledTimes(2);
    expect(browserPoolSize()).toBe(2);
  });

  it('treats launchArgs order-independently (same profile)', async () => {
    await getOrCreateBrowser({ args: ['--a', '--b'] });
    await getOrCreateBrowser({ args: ['--b', '--a'] });
    expect(chromium.launch).toHaveBeenCalledTimes(1);
  });

  it('merges extension launchArgs on top of the hardening defaults', async () => {
    await getOrCreateBrowser({ args: ['--mute-audio'] });
    expect(chromium.launch).toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.arrayContaining(['--no-sandbox', '--mute-audio']),
      }),
    );
  });

  it('never evicts a browser still reserved by an in-flight caller', async () => {
    process.env.BROWSER_POOL_MAX = '1';

    const reserved = await getOrCreateBrowser(); // handed out, no context attached yet
    // a concurrent launch over the cap triggers eviction; reserved must survive
    await getOrCreateBrowser({ args: ['--other'] });

    expect(reserved.close).not.toHaveBeenCalled();
    expect(browserPoolSize()).toBe(2);
  });

  it('resumes evicting a browser once its reservation is released', async () => {
    process.env.BROWSER_POOL_MAX = '1';

    const first = await getOrCreateBrowser();
    const second = await getOrCreateBrowser({ args: ['--second'] });
    releaseReservation(first); // simulates context attachment completing

    // over the cap, can reclaim the released browser but not the reserved one
    await getOrCreateBrowser({ args: ['--third'] });

    expect(first.close).toHaveBeenCalled();
    expect(second.close).not.toHaveBeenCalled();
  });

  it('closes and clears every pooled browser', async () => {
    await getOrCreateBrowser();
    await getOrCreateBrowser({ args: ['--x'] });
    expect(browserPoolSize()).toBe(2);
    await closeBrowser();
    expect(browserPoolSize()).toBe(0);
  });
});
