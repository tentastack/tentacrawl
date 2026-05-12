#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const args = new Set(argv);
const useDockerDeps = !args.has('--no-deps');
const serviceArg = argv.find((arg) => arg.startsWith('--service='));
const selectedServices = serviceArg
  ? new Set(
      serviceArg
        .slice('--service='.length)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    )
  : null;

const sharedEnv = {
  MONGO_URI: process.env.MONGO_URI ?? 'mongodb://localhost:27017',
  MONGO_DB_NAME: process.env.MONGO_DB_NAME ?? 'tentacrawl',
  REDIS_HOST: process.env.REDIS_HOST ?? 'localhost',
  REDIS_PORT: process.env.REDIS_PORT ?? '6379',
};

const services = [
  {
    name: 'api',
    color: 36,
    command: 'pnpm',
    args: ['--filter', '@tentacrawl/api', 'run', 'start:dev'],
    env: {
      ...sharedEnv,
      PORT: process.env.API_PORT ?? '3000',
    },
  },
  {
    name: 'worker',
    color: 35,
    command: 'pnpm',
    args: ['--filter', '@tentacrawl/worker', 'run', 'start:dev'],
    env: {
      ...sharedEnv,
      PORT: process.env.WORKER_PORT ?? '3002',
    },
  },
  {
    name: 'web',
    color: 33,
    command: 'pnpm',
    args: ['--filter', '@tentacrawl/web', 'run', 'dev'],
    env: {
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? `http://localhost:${process.env.API_PORT ?? '3000'}`,
    },
  },
];

const activeServices = selectedServices
  ? services.filter((service) => selectedServices.has(service.name))
  : services;

if (selectedServices) {
  const knownServices = new Set(services.map((service) => service.name));
  const unknownServices = [...selectedServices].filter((name) => !knownServices.has(name));

  if (unknownServices.length > 0) {
    console.error(`Unknown service selection: ${unknownServices.join(', ')}`);
    process.exit(1);
  }
}

if (activeServices.length === 0) {
  console.error('No services selected to start.');
  process.exit(1);
}

const children = [];
let shuttingDown = false;

function prefixOutput(stream, label, color) {
  let pending = '';
  stream.on('data', (chunk) => {
    pending += chunk.toString();
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? '';
    for (const line of lines) {
      if (line.length === 0) {
        continue;
      }
      process.stdout.write(`\x1b[${color}m[${label}]\x1b[0m ${line}\n`);
    }
  });
  stream.on('end', () => {
    if (pending.length > 0) {
      process.stdout.write(`\x1b[${color}m[${label}]\x1b[0m ${pending}\n`);
    }
  });
}

function ensureDockerDeps() {
  const result = spawnSync('docker', ['compose', 'up', '-d'], {
    cwd: rootDir,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGINT');
    }
  }

  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) {
        child.kill('SIGTERM');
      }
    }
    process.exit(exitCode);
  }, 250);
}

function startService(service) {
  const child = spawn(service.command, service.args, {
    cwd: rootDir,
    env: {
      ...process.env,
      ...service.env,
    },
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  prefixOutput(child.stdout, service.name, service.color);
  prefixOutput(child.stderr, service.name, service.color);

  child.on('exit', (code) => {
    if (!shuttingDown && code && code !== 0) {
      console.error(`[${service.name}] exited with code ${code}`);
      shutdown(code);
    }
  });

  children.push(child);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

if (useDockerDeps) {
  ensureDockerDeps();
}

for (const service of activeServices) {
  startService(service);
}