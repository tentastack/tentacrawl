import type { Page } from 'playwright';
import type { CompiledStep } from '@tentacrawl/dsl';
import type { ChallengerStepInfo } from '@tentacrawl/core';
import type { ChallengerRunSession } from './port/challenger-dispatcher';
import { navigateWithChallenger } from './challenger-integration';

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
  error?: string;
}

export function toStepInfo(step: CompiledStep): ChallengerStepInfo {
  return {
    ...step.fields,
    index: step.index,
    action: step.action,
    selector: step.selector,
    value: step.value,
    outputKey: step.outputKey,
    attr: step.attr,
    condition: step.condition,
    timeoutMs: step.timeoutMs,
  };
}

async function handleGoto(
  page: Page,
  step: CompiledStep,
  session?: ChallengerRunSession,
): Promise<ActionResult> {
  const { response, aborted } = await navigateWithChallenger(
    page,
    step.value!,
    { waitUntil: 'domcontentloaded', timeout: step.timeoutMs ?? 30_000 },
    session,
    'dsl-step',
    toStepInfo(step),
  );
  if (aborted) {
    return { error: `Navigation aborted by challenger: ${aborted.reason ?? 'no reason'}` };
  }
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

type ActionHandler = (
  page: Page,
  step: CompiledStep,
  session?: ChallengerRunSession,
) => Promise<ActionResult>;

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
  session?: ChallengerRunSession,
): Promise<StepResult> {
  const start = Date.now();
  const handler = ACTION_HANDLERS[step.action];

  if (!handler) {
    if (step.action === 'assert') {
      return handleAssert(page, step, start);
    }
    if (session?.resolveAction(step.action)) {
      return executeChallengerAction(page, step, session, start);
    }
    return {
      index: step.index,
      action: step.action,
      durationMs: 0,
      error: `Unknown action: ${step.action}`,
    };
  }

  try {
    const actionResult = await handler(page, step, session);
    return {
      index: step.index,
      action: step.action,
      durationMs: Date.now() - start,
      output: actionResult.output,
      httpStatus: actionResult.httpStatus,
      error: actionResult.error,
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

async function executeChallengerAction(
  page: Page,
  step: CompiledStep,
  session: ChallengerRunSession,
  start: number,
): Promise<StepResult> {
  try {
    session.ctx.raw.page = page;
    const result = await session.runAction(step.action, toStepInfo(step));
    if (!result) {
      return {
        index: step.index,
        action: step.action,
        durationMs: Date.now() - start,
        error: `Unknown action: ${step.action}`,
      };
    }
    return {
      index: step.index,
      action: step.action,
      durationMs: Date.now() - start,
      output: result.output === undefined ? undefined : serializeOutput(result.output),
      httpStatus: result.httpStatus,
      error: result.error,
      preconditionFailed: result.preconditionFailed,
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

function serializeOutput(output: unknown): string {
  return typeof output === 'string' ? output : JSON.stringify(output);
}
