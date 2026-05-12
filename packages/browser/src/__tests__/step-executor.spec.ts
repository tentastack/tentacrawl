import { executeStep } from '../step-executor';
import type { CompiledStep } from '@tentacrawl/dsl';

function createMockPage() {
  const mockLocator = {
    click: jest.fn().mockResolvedValue(undefined),
    fill: jest.fn().mockResolvedValue(undefined),
    innerText: jest.fn().mockResolvedValue('extracted text'),
    innerHTML: jest.fn().mockResolvedValue('<div>html</div>'),
    getAttribute: jest.fn().mockResolvedValue('attr-value'),
    count: jest.fn().mockResolvedValue(1),
  };

  return {
    goto: jest.fn().mockResolvedValue(undefined),
    click: jest.fn().mockResolvedValue(undefined),
    waitForSelector: jest.fn().mockResolvedValue(undefined),
    locator: jest.fn().mockReturnValue(mockLocator),
    screenshot: jest.fn().mockResolvedValue(Buffer.from('fake-png')),
    content: jest.fn().mockResolvedValue('<!DOCTYPE html><html><body>full page</body></html>'),
    _mockLocator: mockLocator,
  };
}

type MockPage = ReturnType<typeof createMockPage>;

describe('executeStep', () => {
  let page: MockPage;

  beforeEach(() => {
    page = createMockPage();
  });

  it('handles goto action', async () => {
    const step: CompiledStep = { index: 0, action: 'goto', value: 'https://example.com' };
    const result = await executeStep(page as never, step);
    expect(result.action).toBe('goto');
    expect(result.error).toBeUndefined();
    expect(page.goto).toHaveBeenCalledWith('https://example.com', expect.any(Object));
  });

  it('handles click action', async () => {
    const step: CompiledStep = { index: 1, action: 'click', selector: '#btn' };
    const result = await executeStep(page as never, step);
    expect(result.action).toBe('click');
    expect(result.error).toBeUndefined();
    expect(page.click).toHaveBeenCalledWith('#btn', expect.any(Object));
  });

  it('handles fill action', async () => {
    const step: CompiledStep = { index: 2, action: 'fill', selector: '#input', value: 'test' };
    const result = await executeStep(page as never, step);
    expect(result.error).toBeUndefined();
    expect(page._mockLocator.fill).toHaveBeenCalledWith('test', expect.any(Object));
  });

  it('handles waitFor action', async () => {
    const step: CompiledStep = { index: 3, action: 'waitFor', selector: '.loaded' };
    const result = await executeStep(page as never, step);
    expect(result.error).toBeUndefined();
    expect(page.waitForSelector).toHaveBeenCalledWith('.loaded', expect.any(Object));
  });

  it('handles extractText action', async () => {
    const step: CompiledStep = { index: 4, action: 'extractText', selector: '#content', outputKey: 'text' };
    const result = await executeStep(page as never, step);
    expect(result.output).toBe('extracted text');
    expect(result.error).toBeUndefined();
  });

  it('handles extractHtml action', async () => {
    const step: CompiledStep = { index: 5, action: 'extractHtml', selector: '#div', outputKey: 'html' };
    const result = await executeStep(page as never, step);
    expect(result.output).toBe('<div>html</div>');
  });

  it('handles extract alias as extractHtml', async () => {
    const step: CompiledStep = { index: 6, action: 'extract', selector: '#main', outputKey: 'page' };
    const result = await executeStep(page as never, step);
    expect(result.output).toBe('<div>html</div>');
  });

  it('handles extractAttr action', async () => {
    const step: CompiledStep = { index: 7, action: 'extractAttr', selector: 'a', outputKey: 'href', attr: 'href' };
    const result = await executeStep(page as never, step);
    expect(result.output).toBe('attr-value');
  });

  it('handles screenshot action', async () => {
    const step: CompiledStep = { index: 8, action: 'screenshot', outputKey: 'shot' };
    const result = await executeStep(page as never, step);
    expect(result.output).toBeDefined();
    expect(typeof result.output).toBe('string');
  });

  it('returns error for unknown action', async () => {
    const step = { index: 9, action: 'unknownAction' } as unknown as CompiledStep;
    const result = await executeStep(page as never, step);
    expect(result.error).toContain('Unknown action');
  });

  it('captures errors from page methods', async () => {
    page.goto.mockRejectedValue(new Error('net::ERR_CONNECTION_REFUSED'));
    const step: CompiledStep = { index: 0, action: 'goto', value: 'https://down.example.com' };
    const result = await executeStep(page as never, step);
    expect(result.error).toContain('ERR_CONNECTION_REFUSED');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('records timing for each step', async () => {
    const step: CompiledStep = { index: 0, action: 'goto', value: 'https://example.com' };
    const result = await executeStep(page as never, step);
    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('handles wait action (delays execution)', async () => {
    const step: CompiledStep = { index: 10, action: 'wait', value: '50' };
    const result = await executeStep(page as never, step);
    expect(result.error).toBeUndefined();
    expect(result.durationMs).toBeGreaterThanOrEqual(40);
  });

  it('handles saveSource action', async () => {
    const step: CompiledStep = { index: 11, action: 'saveSource', outputKey: 'full_page' };
    const result = await executeStep(page as never, step);
    expect(result.error).toBeUndefined();
    expect(result.output).toContain('full page');
    expect(page.content).toHaveBeenCalled();
  });

  describe('assert action', () => {
    it('passes assert contains when text matches', async () => {
      page._mockLocator.innerText.mockResolvedValueOnce('hello world');
      const step: CompiledStep = {
        index: 12,
        action: 'assert',
        selector: 'body',
        condition: 'contains',
        value: 'hello',
      };
      const result = await executeStep(page as never, step);
      expect(result.error).toBeUndefined();
      expect(result.preconditionFailed).toBeUndefined();
    });

    it('fails assert contains when text does not match', async () => {
      page._mockLocator.innerText.mockResolvedValueOnce('hello world');
      const step: CompiledStep = {
        index: 13,
        action: 'assert',
        selector: 'body',
        condition: 'contains',
        value: 'missing',
      };
      const result = await executeStep(page as never, step);
      expect(result.error).toContain('does not contain');
      expect(result.preconditionFailed).toBe(true);
    });

    it('passes assert notContains when text is absent', async () => {
      page._mockLocator.innerText.mockResolvedValueOnce('hello world');
      const step: CompiledStep = {
        index: 14,
        action: 'assert',
        selector: 'body',
        condition: 'notContains',
        value: 'missing',
      };
      const result = await executeStep(page as never, step);
      expect(result.error).toBeUndefined();
      expect(result.preconditionFailed).toBeUndefined();
    });

    it('fails assert notContains when text is present', async () => {
      page._mockLocator.innerText.mockResolvedValueOnce('error nie została odnaleziona');
      const step: CompiledStep = {
        index: 15,
        action: 'assert',
        selector: 'body',
        condition: 'notContains',
        value: 'nie została odnaleziona',
      };
      const result = await executeStep(page as never, step);
      expect(result.error).toContain('should not');
      expect(result.preconditionFailed).toBe(true);
    });

    it('passes assert exists when element is found', async () => {
      page._mockLocator.count.mockResolvedValueOnce(1);
      const step: CompiledStep = {
        index: 16,
        action: 'assert',
        selector: '#present',
        condition: 'exists',
      };
      const result = await executeStep(page as never, step);
      expect(result.error).toBeUndefined();
    });

    it('fails assert exists when element is missing', async () => {
      page._mockLocator.count.mockResolvedValueOnce(0);
      const step: CompiledStep = {
        index: 17,
        action: 'assert',
        selector: '#missing',
        condition: 'exists',
      };
      const result = await executeStep(page as never, step);
      expect(result.error).toContain('does not exist');
      expect(result.preconditionFailed).toBe(true);
    });

    it('passes assert notExists when element is absent', async () => {
      page._mockLocator.count.mockResolvedValueOnce(0);
      const step: CompiledStep = {
        index: 18,
        action: 'assert',
        selector: '#gone',
        condition: 'notExists',
      };
      const result = await executeStep(page as never, step);
      expect(result.error).toBeUndefined();
    });

    it('fails assert notExists when element exists', async () => {
      page._mockLocator.count.mockResolvedValueOnce(2);
      const step: CompiledStep = {
        index: 19,
        action: 'assert',
        selector: '#still-here',
        condition: 'notExists',
      };
      const result = await executeStep(page as never, step);
      expect(result.error).toContain('exists but should not');
      expect(result.preconditionFailed).toBe(true);
    });
  });
});
