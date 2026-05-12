import type { CompileResult } from '@tentacrawl/dsl';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const mockLocator = {
    click: jest.fn().mockResolvedValue(undefined),
    fill: jest.fn().mockResolvedValue(undefined),
    innerText: jest.fn().mockResolvedValue('extracted text'),
    innerHTML: jest.fn().mockResolvedValue('<div>page content</div>'),
    getAttribute: jest.fn().mockResolvedValue('attr-value'),
    count: jest.fn().mockResolvedValue(1),
  };

const mockPage = {
  goto: jest.fn().mockImplementation(async () => {
    return { status: () => 200 };
  }),
  url: jest.fn().mockReturnValue('https://example.com/final'),
  click: jest.fn().mockResolvedValue(undefined),
  on: jest.fn().mockReturnThis(),
  waitForSelector: jest.fn().mockResolvedValue(undefined),
  locator: jest.fn().mockReturnValue(mockLocator),
  screenshot: jest.fn().mockResolvedValue(Buffer.from('png')),
  content: jest.fn().mockResolvedValue('<!DOCTYPE html><html></html>'),
  close: jest.fn().mockResolvedValue(undefined),
};

const mockContext = {
  newPage: jest.fn().mockResolvedValue(mockPage),
  addInitScript: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
};

const mockBrowser = {
  isConnected: jest.fn().mockReturnValue(true),
  newContext: jest.fn().mockResolvedValue(mockContext),
};

jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn().mockResolvedValue(mockBrowser),
  },
}));

import { runDsl } from '../runner';

describe('runDsl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPage.url.mockReturnValue('https://example.com/final');
    mockPage.goto.mockImplementation(async () => {
      return { status: () => 200 };
    });
    mockPage.click.mockResolvedValue(undefined);
  });

  const compiled: CompileResult = {
    name: 'test-dsl',
    steps: [
      { index: 0, action: 'goto', value: 'https://example.com' },
      { index: 1, action: 'click', selector: '#link' },
      { index: 2, action: 'extract', selector: '#content', outputKey: 'page_main' },
    ],
  };

  it('produces artifacts from extract steps', async () => {
    const result = await runDsl(compiled, { workerId: 'w-1' });
    expect(result.status).toBe('OK');
    expect(result.artifacts).toHaveProperty('page_main');
    expect(result.artifacts['page_main']).toBe('<div>page content</div>');
  });

  it('produces a trace with all steps', async () => {
    const result = await runDsl(compiled, { workerId: 'w-1' });
    expect(result.trace.steps).toHaveLength(3);
    expect(result.trace.steps[0].action).toBe('goto');
    expect(result.trace.steps[2].action).toBe('extract');
  });

  it('includes environment metadata', async () => {
    const result = await runDsl(compiled, { workerId: 'w-1' });
    expect(result.env.userAgent).toBeDefined();
    expect(result.env.viewport).toMatch(/^\d+x\d+$/);
  });

  it('includes proxyServer in env when provided', async () => {
    const result = await runDsl(compiled, {
      workerId: 'w-1',
      proxy: { server: 'http://proxy:8080', id: 'proxy-42' },
    });
    expect(result.env.proxyServer).toBe('http://proxy:8080');
  });

  it('stops on error and sets status to ERROR', async () => {
    mockPage.click.mockRejectedValueOnce(new Error('element not found'));
    const result = await runDsl(compiled, { workerId: 'w-1' });
    expect(result.status).toBe('ERROR');
    const failedStep = result.trace.steps.find((s) => s.error);
    expect(failedStep).toBeDefined();
    expect(failedStep!.error).toContain('element not found');
  });

  it('closes page and context in finally block', async () => {
    await runDsl(compiled, { workerId: 'w-1' });
    expect(mockPage.close).toHaveBeenCalled();
    expect(mockContext.close).toHaveBeenCalled();
  });

  it('does not capture screenshots when debugScreenshots is disabled', async () => {
    mockPage.screenshot.mockClear();
    const result = await runDsl(compiled, { workerId: 'w-1' });
    expect(result.trace.steps.every((s) => s.screenshotPath === undefined)).toBe(true);
    expect(mockPage.screenshot).not.toHaveBeenCalled();
  });

  it('captures debug screenshots for each step when enabled', async () => {
    mockPage.screenshot.mockClear();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tentacrawl-test-'));
    const result = await runDsl(compiled, {
      workerId: 'w-1',
      debugScreenshots: { enabled: true, baseDir: tmpDir, runId: 'test-run' },
    });

    const screenshotDir = path.join(tmpDir, 'test-run');
    expect(fs.existsSync(screenshotDir)).toBe(true);

    expect(result.trace.steps).toHaveLength(3);
    for (const step of result.trace.steps) {
      expect(step.screenshotPath).toBeDefined();
      expect(step.screenshotPath).toContain(screenshotDir);
    }

    expect(mockPage.screenshot).toHaveBeenCalledTimes(3);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('captures screenshot on error step when debug enabled', async () => {
    mockPage.screenshot.mockClear();
    mockPage.click.mockRejectedValueOnce(new Error('element not found'));
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tentacrawl-test-'));
    const result = await runDsl(compiled, {
      workerId: 'w-1',
      debugScreenshots: { enabled: true, baseDir: tmpDir, runId: 'err-run' },
    });

    expect(result.status).toBe('ERROR');
    const failedStep = result.trace.steps.find((s) => s.error);
    expect(failedStep?.screenshotPath).toBeDefined();
    expect(failedStep?.screenshotPath).toContain('err-run');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('generates runId when not provided', async () => {
    mockPage.screenshot.mockClear();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tentacrawl-test-'));
    const result = await runDsl(compiled, {
      workerId: 'w-1',
      debugScreenshots: { enabled: true, baseDir: tmpDir },
    });

    expect(result.trace.steps[0].screenshotPath).toBeDefined();
    expect(result.trace.steps[0].screenshotPath).toContain('run-');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('sets PRECONDITION_FAILED when assert step fails', async () => {
    mockLocator.innerText.mockResolvedValueOnce(undefined);
    mockLocator.count.mockResolvedValueOnce(0);
    const assertCompiled: CompileResult = {
      name: 'assert-test',
      steps: [
        { index: 0, action: 'goto', value: 'https://example.com' },
        { index: 1, action: 'assert', selector: '#missing', condition: 'exists' },
        { index: 2, action: 'extract', selector: '#content', outputKey: 'data' },
      ],
    };
    const result = await runDsl(assertCompiled, { workerId: 'w-1' });
    expect(result.status).toBe('PRECONDITION_FAILED');
    expect(result.trace.steps).toHaveLength(2);
    expect(result.trace.steps[1].error).toContain('does not exist');
  });

  it('uses proxy from options when provided', async () => {
    const compiled: CompileResult = {
      name: 'proxy-test',
      steps: [
        { index: 0, action: 'goto', value: 'https://example.com' },
      ],
    };
    await runDsl(compiled, {
      workerId: 'w-1',
      proxy: { server: 'http://brd:8080', username: 'user', password: 'pass' },
    });
    expect(mockBrowser.newContext).toHaveBeenCalledWith(
      expect.objectContaining({
        proxy: expect.objectContaining({
          server: 'http://brd:8080',
          username: 'user',
          password: 'pass',
        }),
      }),
    );
  });

  it('sets BLOCKED status when navigation returns 403', async () => {
    mockPage.goto.mockResolvedValueOnce({ status: () => 403 });
    const result = await runDsl(compiled, { workerId: 'w-1' });
    expect(result.status).toBe('BLOCKED');
  });
});
