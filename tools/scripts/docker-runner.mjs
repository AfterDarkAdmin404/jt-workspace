#!/usr/bin/env node
/**
 * Cross-platform dynamic Docker runner for Nx monorepo apps.
 *
 * Usage:
 *   yarn docker:build <app-name>
 *   yarn docker:run <app-name>
 *   yarn docker:stop <app-name>
 *   yarn docker:logs <app-name>
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../..');

const VALID_COMMANDS = new Set(['build', 'run', 'stop', 'logs']);

function getAvailableApps() {
  const appsRoot = path.join(workspaceRoot, 'apps');
  if (!fs.existsSync(appsRoot)) return [];
  return fs
    .readdirSync(appsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!command || !VALID_COMMANDS.has(command)) {
    console.error(
      `Invalid or missing command "${command ?? ''}". Expected one of: ${[...VALID_COMMANDS].join(', ')}`
    );
    process.exit(1);
  }

  let appName = '';
  const extraFlags = [];

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg.startsWith('--app=')) {
      appName = arg.slice('--app='.length);
    } else if (arg === '--app' && rest[i + 1]) {
      appName = rest[++i];
    } else if (arg.startsWith('-')) {
      extraFlags.push(arg);
    } else if (!appName) {
      appName = arg;
    } else {
      extraFlags.push(arg);
    }
  }

  return { command, appName, extraFlags };
}

function runDocker(args, { ignoreFailure = false } = {}) {
  const result = spawnSync('docker', args, {
    cwd: workspaceRoot,
    stdio: 'inherit',
  });
  if (result.error) {
    console.error(`Failed to execute docker: ${result.error.message}`);
    process.exit(1);
  }
  if (!ignoreFailure && result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  return result.status ?? 0;
}

function main() {
  const { command, appName, extraFlags } = parseArgs(process.argv.slice(2));
  const availableApps = getAvailableApps();

  if (!appName) {
    console.error(
      `Missing target app name. Available apps: ${availableApps.join(', ') || '(none)'}`
    );
    process.exit(1);
  }

  const appDir = path.resolve(workspaceRoot, 'apps', appName);
  if (!fs.existsSync(appDir) || !fs.statSync(appDir).isDirectory()) {
    console.error(
      `Target app "${appName}" not found under apps/. Available apps: ${availableApps.join(', ') || '(none)'}`
    );
    process.exit(1);
  }

  const imageName = `jt-${appName}:latest`;
  const containerName = `jt-${appName}`;
  const dockerfilePath = path.posix.join('apps', appName, 'Dockerfile');
  const dockerfileFsPath = path.join(appDir, 'Dockerfile');
  const envFile = path.posix.join('apps', appName, '.env.dev');

  switch (command) {
    case 'build':
      if (!fs.existsSync(dockerfileFsPath)) {
        console.error(`Dockerfile not found for "${appName}" at ${dockerfilePath}`);
        process.exit(1);
      }
      runDocker([
        'build',
        '--build-arg',
        `APP_NAME=${appName}`,
        '-t',
        imageName,
        '-f',
        dockerfilePath,
        ...extraFlags,
        '.',
      ]);
      break;
    case 'run': {
      runDocker(['rm', '-f', containerName], { ignoreFailure: true });
      const dbHost = process.env.DB_HOST ?? 'host.docker.internal';
      const redisHost = process.env.REDIS_HOST ?? 'host.docker.internal';
      runDocker([
        'run',
        '-d',
        '--name',
        containerName,
        '--env-file',
        envFile,
        '-p',
        '3000:3000',
        '--add-host=host.docker.internal:host-gateway',
        '-e',
        `DB_HOST=${dbHost}`,
        '-e',
        `REDIS_HOST=${redisHost}`,
        ...extraFlags,
        imageName,
      ]);
      break;
    }
    case 'stop':
      runDocker(['rm', '-f', containerName]);
      break;
    case 'logs':
      runDocker(['logs', '-f', containerName]);
      break;
  }
}

main();
