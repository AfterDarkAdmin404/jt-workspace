import type { AuditLogModuleOptions } from '@jt-workspace/nest-lib';
import { APP_NAME } from './app.config';

export const auditLogConfig: AuditLogModuleOptions = {
  appName: APP_NAME,
  isGlobal: true,
};
