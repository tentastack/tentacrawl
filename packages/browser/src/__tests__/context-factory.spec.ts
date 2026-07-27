const mockContext = {
  addInitScript: jest.fn().mockResolvedValue(undefined),
};

const mockBrowser = {
  isConnected: jest.fn().mockReturnValue(true),
  newContext: jest.fn().mockResolvedValue(mockContext),
  close: jest.fn().mockResolvedValue(undefined),
  on: jest.fn().mockReturnThis(),
  contexts: jest.fn().mockReturnValue([]),
};

jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn().mockResolvedValue(mockBrowser),
  },
}));

import { createHardenedContext } from '../context-factory';
import { closeBrowser } from '../browser-pool';

describe('createHardenedContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBrowser.isConnected.mockReturnValue(true);
    mockBrowser.newContext.mockResolvedValue(mockContext);
  });

  afterEach(async () => {
    await closeBrowser();
  });

  it('creates a browser context with stealth defaults', async () => {
    const { context, stealth } = await createHardenedContext();

    expect(context).toBe(mockContext);
    expect(stealth.userAgent).toBeDefined();
    expect(stealth.viewport).toBeDefined();
    expect(mockContext.addInitScript).toHaveBeenCalled();
  });

  it('passes proxy config to browser context', async () => {
    await createHardenedContext({
      proxy: { server: 'http://proxy:8080', username: 'u', password: 'p' },
    });

    expect(mockBrowser.newContext).toHaveBeenCalledWith(
      expect.objectContaining({
        proxy: { server: 'http://proxy:8080', username: 'u', password: 'p' },
      }),
    );
  });
});