#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { chromium } from 'playwright';
import { parseAndCompile } from '@tentacrawl/dsl';
import { executeStep } from '../src/step-executor';
import { getStealthDefaults } from '../src/stealth';
import type { DebugScreenshotConfig } from '../src/runner';

const args = process.argv.slice(2);

function flagValue(name: string, fallback: string): string {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return fallback;
  return args[idx + 1];
}
function hasFlag(name: string): boolean {
  return args.includes(name);
}

const SCREENSHOTS_BASE = path.resolve(__dirname, '.screenshots');

const DEFAULT_FIXTURE = path.resolve(
  __dirname,
  'fixtures/example-scrape.yaml',
);

const yamlPath = args.find((a) => !a.startsWith('--')) ?? DEFAULT_FIXTURE;
const resolvedPath = path.resolve(process.cwd(), yamlPath);
const slowMo = parseInt(flagValue('--slow', '100'), 10);
const headless = hasFlag('--headless');
const noScreenshots = hasFlag('--no-screenshots');
const paramsJson = flagValue('--params', '{}');
const proxyArg = flagValue('--proxy', '');

async function main() {
  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }
  const yamlText = fs.readFileSync(resolvedPath, 'utf-8');
  let params: Record<string, unknown>;
  try {
    params = JSON.parse(paramsJson) as Record<string, unknown>;
  } catch {
    console.error(`Invalid --params JSON: ${paramsJson}`);
    process.exit(1);
  }

  const compiled = parseAndCompile(yamlText, { params });
  const runId = `${compiled.name}-${new Date().toISOString().replace(/[:.]/g, '-')}`;

  const screenshotConfig: DebugScreenshotConfig = {
    enabled: !noScreenshots,
    baseDir: SCREENSHOTS_BASE,
    runId,
  };

  const screenshotDir = screenshotConfig.enabled
    ? path.join(SCREENSHOTS_BASE, runId)
    : undefined;

  if (screenshotDir) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  console.log(`\n--- Sandbox: ${compiled.name} ---`);
  console.log(`Steps: ${compiled.steps.length}`);
  console.log(`Mode:  ${headless ? 'headless' : 'headed'} | slowMo: ${slowMo}ms`);
  if (screenshotDir) {
    console.log(`Screenshots: ${screenshotDir}`);
  }
  console.log('');

  const stealth = getStealthDefaults();

  // resolve proxy: CLI --proxy flag > DSL inline proxy
  let proxyConfig: { server: string; username?: string; password?: string } | undefined;
  if (proxyArg) {
    const [server, username, password] = proxyArg.split(',');
    proxyConfig = { server, username, password };
    console.log(`Proxy (CLI): ${server}`);
  }

  const browser = await chromium.launch({
    headless,
    slowMo,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
    ],
  });

  const context = await browser.newContext({
    userAgent: stealth.userAgent,
    viewport: stealth.viewport,
    locale: 'pl-PL',
    timezoneId: 'Europe/Warsaw',
    ...(proxyConfig ? { proxy: { server: proxyConfig.server, username: proxyConfig.username, password: proxyConfig.password } } : {}),
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const page = await context.newPage();
  const artifacts: Record<string, unknown> = {};
  let hadError = false;

  for (const step of compiled.steps) {
    const label = `[${step.index}] ${step.action}${step.selector ? ` ${step.selector}` : ''}${step.value ? ` → ${step.value}` : ''}`;
    process.stdout.write(`  ${label} ... `);

    const result = await executeStep(page, step);

    if (result.error) {
      const tag = result.preconditionFailed ? 'PRECONDITION_FAILED' : 'ERROR';
      console.log(`${tag} (${result.durationMs}ms)`);
      console.error(`     ${result.error}`);
      if (screenshotDir) {
        const errorFile = path.join(
          screenshotDir,
          `step-${String(step.index).padStart(3, '0')}-${step.action}-${tag}.png`,
        );
        await page.screenshot({ path: errorFile, fullPage: true }).catch(() => {});
        console.log(`     screenshot: ${errorFile}`);
      }
      hadError = true;
      break;
    }

    console.log(`OK (${result.durationMs}ms)`);

    if (screenshotDir) {
      const screenshotFile = path.join(
        screenshotDir,
        `step-${String(step.index).padStart(3, '0')}-${step.action}.png`,
      );
      await page.screenshot({ path: screenshotFile, fullPage: true }).catch(() => {});
    }

    if (result.output !== undefined) {
      const key = step.outputKey ?? `step_${step.index}`;
      artifacts[key] = result.output;
    }
  }

  console.log('\n--- Artifacts ---');
  for (const [key, value] of Object.entries(artifacts)) {
    const preview =
      typeof value === 'string' && value.length > 120
        ? `${value.slice(0, 120)}...`
        : value;
    console.log(`  ${key}: ${preview}`);
  }

  if (screenshotDir) {
    const files = fs.readdirSync(screenshotDir);
    console.log(`\n--- Screenshots (${files.length}) ---`);
    for (const f of files) {
      console.log(`  ${path.join(screenshotDir, f)}`);
    }
  }

  if (!headless && !hadError) {
    console.log('\nBrowser is open. Press Ctrl+C to close.');
    await new Promise(() => {});
  }

  await context.close();
  await browser.close();

  process.exit(hadError ? 1 : 0);
}

main().catch((err) => {
  console.error('Sandbox fatal error:', err);
  process.exit(1);
});
