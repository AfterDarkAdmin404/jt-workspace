import * as dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { initTelemetry } from '@jt-workspace/nest-lib/telemetry';

const envCandidates = [
  resolve(process.cwd(), 'apps/ikagi-api/.env.dev'),
  resolve(process.cwd(), 'apps/ikagi-api/.env'),
  resolve(process.cwd(), '.env.dev'),
  resolve(process.cwd(), '.env'),
  resolve(__dirname, '../.env.dev'),
  resolve(__dirname, '../.env'),
];

for (const envPath of envCandidates) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

initTelemetry({
  serviceName: process.env.OTEL_SERVICE_NAME || 'ikagi-api',
});
