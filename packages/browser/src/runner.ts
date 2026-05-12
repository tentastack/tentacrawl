import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Page } from 'playwright';
import type { CompileResult } from '@tentacrawl/dsl';
import type {
  TraceStep,
  RunOutcome,
} from '@tentacrawl/core';
import {
  createHardenedContext,
  type ContextOptions,
  type ProxyConfig,
} from './context-factory';
import { executeStep } from './step-executor';
import type { StealthDefaults } from './stealth';

export interface RunnerResult {
  status: RunOutcome;
  artifacts: Record<string, unknown>;
  trace: { steps: TraceStep[] };
  env: {
    userAgent: string;
    viewport: string;
    proxyServer?: string;
  };
}

export interface RunnerOptions {
  workerId: string;
  jobId?: string;
  proxy?: ProxyConfig & { id?: string };
  stealth?: Partial<StealthDefaults>;
  debugScreenshots?: DebugScreenshotConfig;
}

export interface DebugScreenshotConfig {
  enabled: boolean;
  baseDir: string;
  runId?: string;
}

const BLOCKED_HTTP_STATUSES = new Set([403, 407, 429, 503]);
const NAVIGATION_ACTIONS = new Set(['goto', 'click']);

export async function runDsl(
  compiled: CompileResult,
  options: RunnerOptions,
): Promise<RunnerResult> {
  const contextOptions: ContextOptions = {};

  if (options.proxy) {
    contextOptions.proxy = {
      server: options.proxy.server,
      username: options.proxy.username,
      password: options.proxy.password,
    };
  }
  if (options.stealth) {
    contextOptions.stealth = options.stealth;
  }

  const screenshotDir = resolveScreenshotDir(options.debugScreenshots);

  const { context, stealth } = await createHardenedContext(contextOptions);
  const page = await context.newPage();

  const artifacts: Record<string, unknown> = {};
  const traceSteps: TraceStep[] = [];
  let status: RunOutcome = 'OK';

  try {
    for (const step of compiled.steps) {
      const result = await executeStep(page, step);

      const traceStep: TraceStep = {
        index: result.index,
        action: result.action,
        durationMs: result.durationMs,
      };

      if (result.error) {
        traceStep.error = result.error;
        traceStep.screenshotPath = await captureDebugScreenshot(
          page,
          screenshotDir,
          step.index,
          step.action,
        );
        traceSteps.push(traceStep);
        status = result.preconditionFailed ? 'PRECONDITION_FAILED' : 'ERROR';
        break;
      }

      if (NAVIGATION_ACTIONS.has(step.action)) {
        if (result.httpStatus && BLOCKED_HTTP_STATUSES.has(result.httpStatus)) {
          traceStep.error = `Blocked: HTTP ${result.httpStatus}`;
          traceSteps.push(traceStep);
          status = 'BLOCKED';
          break;
        }
      }

      if (result.output !== undefined) {
        const key = step.outputKey ?? `step_${step.index}_${step.action}`;
        artifacts[key] = result.output;
      }

      traceStep.screenshotPath = await captureDebugScreenshot(
        page,
        screenshotDir,
        step.index,
        step.action,
      );
      traceSteps.push(traceStep);
    }
  } finally {
    await page.close();
    await context.close();
  }

  if (screenshotDir) {
    console.log(`Debug screenshots saved to: ${screenshotDir}`);
  }

  return {
    status,
    artifacts,
    trace: { steps: traceSteps },
    env: {
      userAgent: stealth.userAgent,
      viewport: `${stealth.viewport.width}x${stealth.viewport.height}`,
      proxyServer: options.proxy?.server,
    },
  };
}

function resolveScreenshotDir(
  config?: DebugScreenshotConfig,
): string | undefined {
  if (!config?.enabled) return undefined;
  const runId = config.runId ?? `run-${Date.now()}`;
  const dir = path.join(config.baseDir, runId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function captureDebugScreenshot(
  page: Page,
  dir: string | undefined,
  stepIndex: number,
  action: string,
): Promise<string | undefined> {
  if (!dir) return undefined;
  const filename = `step-${String(stepIndex).padStart(3, '0')}-${action}.png`;
  const filePath = path.join(dir, filename);
  try {
    await page.screenshot({ path: filePath, fullPage: true });
    return filePath;
  } catch {
    return undefined;
  }
}
