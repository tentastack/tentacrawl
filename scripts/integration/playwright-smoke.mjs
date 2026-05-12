#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const browserPackageRequire = createRequire(
  new URL('../../packages/browser/package.json', import.meta.url),
);

const { chromium } = browserPackageRequire('playwright');

const args = process.argv.slice(2);

function getArg(flag, fallback) {
  const index = args.indexOf(flag);
  if (index === -1 || index + 1 >= args.length) {
    return fallback;
  }

  return args[index + 1];
}

async function checkHealth(url, label) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`${label} health check failed with status ${response.status}`);
  }

  const payload = await response.json();
  if (payload.status !== 'ok') {
    throw new Error(`${label} health check returned unexpected payload`);
  }
}

async function main() {
  const url = getArg('--url', 'http://localhost:3001');
  const apiHealthUrl = getArg('--api-health', 'http://localhost:3000/health');
  const workerHealthUrl = getArg('--worker-health', 'http://localhost:3002/health');
  const screenshotPath = getArg('--output', path.resolve(process.cwd(), '.artifacts/integration/homepage.png'));

  await checkHealth(apiHealthUrl, 'API');
  await checkHealth(workerHealthUrl, 'Worker');

  const screenshotDir = path.dirname(screenshotPath);
  fs.mkdirSync(screenshotDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForSelector('body', { timeout: 30000 });

  const title = await page.title();
  if (!title || title.trim().length === 0) {
    throw new Error('Web page title is empty');
  }

  await page.screenshot({
    path: screenshotPath,
    fullPage: true,
  });

  await browser.close();

  console.log(`Smoke check passed. Screenshot saved to ${screenshotPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
