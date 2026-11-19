#!/usr/bin/env node
/**
 * Cross-platform TypeORM migration runner for Nx monorepo apps.
 *
 * Supports both root-level centralized invocation:
 *   yarn migration:create <app> <migrationName>
 *   yarn migration:create --app=<app> --name=<migrationName>
 *   yarn migration:generate <app> <migrationName>
 *   yarn migration:run <app>
 *   yarn migration:revert <app>
 *   yarn migration:show <app>
 *
 * And app-level invocation (via apps/<NAME>/package.json scripts):
 *   yarn migration:create <migrationName>
 *   yarn migration:generate <migrationName>
 *   yarn migration:run
 *   yarn migration:revert
 *   yarn migration:show
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../..');

const VALID_ACTIONS = new Set(['create', 'generate', 'run', 'revert', 'show']);

function parseArgs(argv) {
  const [action, ...rest] = argv;
  if (!action || !VALID_ACTIONS.has(action)) {
    console.error(
      `Invalid or missing action "${action ?? ''}". Expected one of: ${[...VALID_ACTIONS].join(', ')}`,
    );
    process.exit(1);
  }

  let appName = '';
  let migrationName = '';
  const positional = [];
  const extraFlags = [];

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg.startsWith('--app=')) {
      appName = arg.slice('--app='.length);
    } else if (arg === '--app' && rest[i + 1]) {
      appName = rest[++i];
    } else if (arg.startsWith('--name=')) {
      migrationName = arg.slice('--name='.length);
    } else if (arg === '--name' && rest[i + 1]) {
      migrationName = rest[++i];
    } else if (arg.startsWith('-')) {
      extraFlags.push(arg);
    } else {
      positional.push(arg);
    }
  }

  if (!appName && positional.length > 0) {
    appName = positional.shift();
  }
  if (!migrationName && positional.length > 0) {
    migrationName = positional.shift();
  }

  return { action, appName, migrationName, extraFlags };
}

function main() {
  const { action, appName, migrationName, extraFlags } = parseArgs(
    process.argv.slice(2),
  );

  if (!appName) {
    console.error(
      'Missing target app name. Example: yarn migration:create ikagi-api InitSchema',
    );
    process.exit(1);
  }

  const appDir = path.join(workspaceRoot, 'apps', appName);
  if (!fs.existsSync(appDir)) {
    console.error(`Target app directory not found: ${appDir}`);
    process.exit(1);
  }

  const dataSourcePath = path.join(appDir, 'src', 'database', 'data-source.ts');
  if (!fs.existsSync(dataSourcePath)) {
    console.error(`DataSource configuration not found: ${dataSourcePath}`);
    process.exit(1);
  }

  const migrationsDir = path.join(appDir, 'src', 'database', 'migrations');
  const appTsConfig = path.join(appDir, 'tsconfig.app.json');
  const fallbackTsConfig = path.join(appDir, 'tsconfig.json');
  const tsConfigPath = fs.existsSync(appTsConfig)
    ? appTsConfig
    : fallbackTsConfig;

  const typeormCli = path.join(
    workspaceRoot,
    'node_modules',
    'typeorm',
    'cli.js',
  );
  if (!fs.existsSync(typeormCli)) {
    console.error(
      `TypeORM CLI not found at ${typeormCli}. Run "yarn install" first.`,
    );
    process.exit(1);
  }

  const cliArgs = [
    '-r',
    'ts-node/register',
    '-r',
    'tsconfig-paths/register',
    typeormCli,
    `migration:${action}`,
  ];

  if (action === 'create' || action === 'generate') {
    if (!migrationName) {
      console.error(
        `Missing migration name for "migration:${action}". Example: yarn migration:${action} ${appName} CreateUsersTable`,
      );
      process.exit(1);
    }
    fs.mkdirSync(migrationsDir, { recursive: true });
    if (action === 'generate') {
      cliArgs.push('-d', dataSourcePath);
    }
    cliArgs.push(path.join(migrationsDir, migrationName));
  } else {
    cliArgs.push('-d', dataSourcePath);
  }

  cliArgs.push(...extraFlags);

  const result = spawnSync(process.execPath, cliArgs, {
    cwd: workspaceRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      TS_NODE_PROJECT: tsConfigPath,
      TS_NODE_TRANSPILE_ONLY: '1',
    },
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  process.exit(result.status ?? 0);
}

main();
