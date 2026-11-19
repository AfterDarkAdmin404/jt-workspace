import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import dotenv from 'dotenv';

const APP_DIR = path.resolve(import.meta.dirname, '..');
const API_DIR = path.join(APP_DIR, 'src', 'api');
const SWAGGER_DIR = path.join(API_DIR, 'swagger');
const GENERATED_BASE_DIR = path.join(API_DIR, 'generated');

function loadEnvFiles() {
  for (const file of ['.env', '.env.local']) {
    const envPath = path.join(APP_DIR, file);
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, override: file === '.env.local' });
    }
  }
}

function parseArgs(argv) {
  const args = { dryRun: false, fetch: false, services: [] };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--dry-run') {
      args.dryRun = true;
    } else if (token === '--fetch') {
      args.fetch = true;
    } else if (token === '--url' && argv[i + 1]) {
      args.url = argv[++i];
      args.fetch = true;
    } else if (token === '--spec' && argv[i + 1]) {
      args.spec = argv[++i];
    } else if (token === '--service' && argv[i + 1]) {
      const raw = argv[++i];
      for (const item of raw.split(',')) {
        const trimmed = item.trim();
        if (trimmed) {
          args.services.push(trimmed);
        }
      }
    } else if (token === '--help' || token === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown or incomplete argument: ${token}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(
    [
      'Usage: node scripts/generate-api.mjs [options]',
      '',
      'By default, scans src/api/swagger/*.json and generates each into src/api/generated/<name>/.',
      'If no .json files exist in src/api/swagger/, exits cleanly with nothing to generate.',
      '',
      'Options:',
      '  --fetch            Fetch /docs/<service>-json from ikagi-api into src/api/swagger/<service>.json.',
      '                     Without --service, refreshes all existing *.json specs in src/api/swagger/.',
      '  --url <url>        Fetch OpenAPI JSON from a specific URL (implies --fetch)',
      '  --service <name>   Service name(s) for --fetch (e.g. auth or auth,profile -> /docs/<name>-json)',
      '  --spec <path>      Generate only for a specific local OpenAPI JSON file',
      '  --dry-run          Validate/run codegen without writing files',
      '  -h, --help         Show this help message',
    ].join('\n'),
  );
}

function getApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.VITE_API_URL ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');
}

function resolveServiceUrl(serviceName) {
  const docsPath = `/docs/${serviceName}-json`;
  return `${getApiBaseUrl()}${docsPath}`;
}

function inferServiceNameFromUrl(url) {
  const pathname = new URL(url).pathname.replace(/\/+$/, '');
  const lastSegment = pathname.split('/').pop() || 'api';
  return lastSegment.replace(/-json$/, '') || 'api';
}

async function fetchAndSaveSpec(url, serviceName, dryRun) {
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    const code = error?.cause?.code || error?.code;
    if (code === 'ECONNREFUSED') {
      console.error(
        `Failed to fetch OpenAPI JSON from ${url}. Ensure ikagi-api is running (yarn nx serve @org/ikagi-api) or place a .json spec in src/api/swagger/.`,
      );
      process.exit(1);
    }
    throw error;
  }

  if (!response.ok) {
    throw new Error(
      `Failed to fetch OpenAPI JSON from ${url}: HTTP ${response.status} ${response.statusText}`,
    );
  }

  const spec = await response.json();
  if (!spec || (typeof spec.openapi !== 'string' && typeof spec.swagger !== 'string')) {
    throw new Error(
      `Invalid OpenAPI payload from ${url}: missing "openapi" or "swagger" key.`,
    );
  }

  const specFilePath = path.join(SWAGGER_DIR, `${serviceName}.json`);
  if (!dryRun) {
    fs.mkdirSync(SWAGGER_DIR, { recursive: true });
    fs.writeFileSync(specFilePath, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');
    console.log(`Saved OpenAPI spec to ${path.relative(APP_DIR, specFilePath)}`);
  } else {
    console.log(`[dry-run] Validated OpenAPI spec from ${url}`);
  }

  return specFilePath;
}

function findLocalSpecs() {
  if (!fs.existsSync(SWAGGER_DIR)) {
    return [];
  }
  return fs
    .readdirSync(SWAGGER_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(SWAGGER_DIR, entry.name))
    .sort();
}

function runCodegen(specPath, outputDir, dryRun) {
  if (!dryRun) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const require = createRequire(import.meta.url);
  const pkgDir = path.dirname(require.resolve('@hey-api/openapi-ts/package.json'));
  const openapiTsBin = path.join(pkgDir, 'bin', 'run.js');

  const cliArgs = [openapiTsBin, '-f', 'openapi-ts.config.ts'];
  if (argsDryRunFlag(dryRun)) {
    cliArgs.push('--dry-run');
  }

  const result = spawnSync(process.execPath, cliArgs, {
    cwd: APP_DIR,
    stdio: 'inherit',
    env: {
      ...process.env,
      OPENAPI_INPUT: specPath,
      OPENAPI_OUTPUT: path.relative(APP_DIR, outputDir),
    },
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function argsDryRunFlag(dryRun) {
  return Boolean(dryRun);
}

async function main() {
  loadEnvFiles();
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  let specFiles = [];

  if (args.fetch) {
    if (args.url) {
      const serviceName = args.services[0] || inferServiceNameFromUrl(args.url);
      console.log(`Fetching OpenAPI spec from ${args.url}...`);
      const savedSpec = await fetchAndSaveSpec(args.url, serviceName, args.dryRun);
      if (!args.dryRun) {
        specFiles.push(savedSpec);
      }
    } else {
      let servicesToFetch = args.services;
      if (servicesToFetch.length === 0) {
        servicesToFetch = findLocalSpecs().map((p) => path.basename(p, '.json'));
      }
      if (servicesToFetch.length === 0) {
        console.error(
          'No existing .json specs found in src/api/swagger/ to refresh. Pass --service <name> (e.g. --service auth) or --url <url>.',
        );
        process.exit(1);
      }

      for (const serviceName of servicesToFetch) {
        const targetUrl = resolveServiceUrl(serviceName);
        console.log(`Fetching OpenAPI spec from ${targetUrl}...`);
        const savedSpec = await fetchAndSaveSpec(targetUrl, serviceName, args.dryRun);
        if (!args.dryRun) {
          specFiles.push(savedSpec);
        }
      }
    }

    if (args.dryRun) {
      return;
    }
  } else if (args.spec) {
    const resolved = path.resolve(APP_DIR, args.spec);
    if (!fs.existsSync(resolved)) {
      throw new Error(`OpenAPI spec file not found: ${resolved}`);
    }
    specFiles = [resolved];
  } else {
    specFiles = findLocalSpecs();
    if (specFiles.length === 0) {
      console.log('No OpenAPI .json specs found in src/api/swagger. Nothing to generate.');
      return;
    }
  }

  for (const specPath of specFiles) {
    const specName = path.basename(specPath, '.json');
    const outputDir = path.join(GENERATED_BASE_DIR, specName);
    console.log(
      `Generating client for ${path.relative(APP_DIR, specPath)} -> ${path.relative(APP_DIR, outputDir)}`,
    );
    runCodegen(specPath, outputDir, args.dryRun);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
