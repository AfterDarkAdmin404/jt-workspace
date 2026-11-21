import type { TelemetryModuleOptions } from '@jt-workspace/nest-lib';
import { APP_NAME } from './app.config';

export const telemetryConfig: TelemetryModuleOptions = {
  serviceName: process.env.OTEL_SERVICE_NAME || APP_NAME,
};
