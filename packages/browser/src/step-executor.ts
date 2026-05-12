import type { Page } from 'playwright';
import type { CompiledStep } from '@tentacrawl/dsl';

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((r) => setTimeout(r, ms));
}

export interface StepResult {
  index: number;
  action: string;
  durationMs: number;
  error?: string;
  output?: string;
  httpStatus?: number;
  preconditionFailed?: boolean;
}

interface ActionResult {
  output?: string;
  httpStatus?: number;
}

async function handleGoto(page: Page, step: CompiledStep): Promise<ActionResult> {
  const response = await page.goto(step.value!, {
    waitUntil: 'domcontentloaded',
    timeout: step.timeoutMs ?? 30_000,
  });
  return { httpStatus: response?.status() };
}

async function handleClick(page: Page, step: CompiledStep): Promise<ActionResult> {
  await randomDelay(80, 250);
  await page.click(step.selector!, { timeout: step.timeoutMs ?? 10_000 });
  return {};
}

async function handleFill(page: Page, step: CompiledStep): Promise<ActionResult> {
  await randomDelay(50, 200);
  const el = page.locator(step.selector!);
  await el.click({ timeout: step.timeoutMs ?? 10_000 });
  await randomDelay(30, 100);
  await el.fill(step.value!, { timeout: step.timeoutMs ?? 10_000 });
  return {};
}

async function handleWaitFor(page: Page, step: CompiledStep): Promise<ActionResult> {
  await page.waitForSelector(step.selector!, {
    timeout: step.timeoutMs ?? 15_000,
  });
  return {};
}

async function handleExtractText(page: Page, step: CompiledStep): Promise<ActionResult> {
  const text = await page.locator(step.selector!).innerText({
    timeout: step.timeoutMs ?? 10_000,
  });
  return { output: text };
}

async function handleExtractHtml(page: Page, step: CompiledStep): Promise<ActionResult> {
  const html = await page.locator(step.selector!).innerHTML({
    timeout: step.timeoutMs ?? 10_000,
  });
  return { output: html };
}

async function handleExtractAttr(page: Page, step: CompiledStep): Promise<ActionResult> {
  const attr = await page.locator(step.selector!).getAttribute(step.attr!, {
    timeout: step.timeoutMs ?? 10_000,
  });
  return { output: attr ?? undefined };
}

async function handleScreenshot(page: Page, _step: CompiledStep): Promise<ActionResult> {
  const buffer = await page.screenshot({ fullPage: true });
  return { output: buffer.toString('base64') };
}

async function handleWait(_page: Page, step: CompiledStep): Promise<ActionResult> {
  const ms = parseInt(step.value!, 10);
  await new Promise((r) => setTimeout(r, ms));
  return {};
}

async function handleSaveSource(page: Page, _step: CompiledStep): Promise<ActionResult> {
  return { output: await page.content() };
}

async function handleAssert(
  page: Page,
  step: CompiledStep,
  start: number,
): Promise<StepResult> {
  try {
    const condition = step.condition!;

    if (condition === 'exists') {
      const count = await page.locator(step.selector!).count();
      if (count === 0) {
        return {
          index: step.index,
          action: step.action,
          durationMs: Date.now() - start,
          error: `Assert failed: element "${step.selector}" does not exist`,
          preconditionFailed: true,
        };
      }
      return { index: step.index, action: step.action, durationMs: Date.now() - start };
    }

    if (condition === 'notExists') {
      const count = await page.locator(step.selector!).count();
      if (count > 0) {
        return {
          index: step.index,
          action: step.action,
          durationMs: Date.now() - start,
          error: `Assert failed: element "${step.selector}" exists but should not`,
          preconditionFailed: true,
        };
      }
      return { index: step.index, action: step.action, durationMs: Date.now() - start };
    }

    const text = await page.locator(step.selector!).innerText({
      timeout: step.timeoutMs ?? 10_000,
    });

    if (condition === 'contains' && !text.includes(step.value!)) {
      return {
        index: step.index,
        action: step.action,
        durationMs: Date.now() - start,
        error: `Assert failed: text does not contain "${step.value}"`,
        preconditionFailed: true,
      };
    }

    if (condition === 'notContains' && text.includes(step.value!)) {
      return {
        index: step.index,
        action: step.action,
        durationMs: Date.now() - start,
        error: `Assert failed: text contains "${step.value}" but should not`,
        preconditionFailed: true,
      };
    }

    return { index: step.index, action: step.action, durationMs: Date.now() - start };
  } catch (err) {
    return {
      index: step.index,
      action: step.action,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

type ActionHandler = (page: Page, step: CompiledStep) => Promise<ActionResult>;

const ACTION_HANDLERS: Record<string, ActionHandler> = {
  goto: handleGoto,
  click: handleClick,
  fill: handleFill,
  waitFor: handleWaitFor,
  extractText: handleExtractText,
  extractHtml: handleExtractHtml,
  extract: handleExtractHtml,
  extractAttr: handleExtractAttr,
  screenshot: handleScreenshot,
  wait: handleWait,
  saveSource: handleSaveSource,
};

export async function executeStep(
  page: Page,
  step: CompiledStep,
): Promise<StepResult> {
  const start = Date.now();
  const handler = ACTION_HANDLERS[step.action];

  if (!handler) {
    if (step.action === 'assert') {
      return handleAssert(page, step, start);
    }
    return {
      index: step.index,
      action: step.action,
      durationMs: 0,
      error: `Unknown action: ${step.action}`,
    };
  }

  try {
    const actionResult = await handler(page, step);
    return {
      index: step.index,
      action: step.action,
      durationMs: Date.now() - start,
      output: actionResult.output,
      httpStatus: actionResult.httpStatus,
    };
  } catch (err) {
    return {
      index: step.index,
      action: step.action,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
