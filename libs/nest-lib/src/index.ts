import { User } from './entities/user.entity';
import { UserActionLog } from './audit/entities/user-action-log.entity';
import { CreateUsersTable1794989500000 } from './migrations/1794989500000-CreateUsersTable';
import { CreateUserActionLogsTable1794990000000 } from './migrations/1794990000000-CreateUserActionLogsTable';

export * from './lib/nest-lib.module';
export { User } from './entities/user.entity';
export type { AuthProvider } from './entities/user.entity';
export { UserActionLog } from './audit/entities/user-action-log.entity';
export { CreateUsersTable1794989500000 } from './migrations/1794989500000-CreateUsersTable';
export { CreateUserActionLogsTable1794990000000 } from './migrations/1794990000000-CreateUserActionLogsTable';

export const SHARED_ENTITIES = [User, UserActionLog];
export const SHARED_MIGRATIONS = [
  CreateUsersTable1794989500000,
  CreateUserActionLogsTable1794990000000,
];

export * from './auth/auth.module';
export * from './auth/auth.service';
export * from './auth/dto';
export * from './auth/guards';
export * from './auth/strategies/local.strategy';
export * from './auth/strategies/jwt.strategy';
export * from './auth/strategies/google.strategy';
export * from './auth/strategies/facebook.strategy';

export * from './audit/audit-log.module';
export * from './audit/audit-log.service';
export * from './audit/interfaces/audit-log.interface';

export * from './cache/redis-cache.module';
export * from './cache/redis-cache.service';
export * from './cache/interfaces/redis-cache-options.interface';

export * from './rate-limit/rate-limit.module';
export * from './rate-limit/dynamic-throttler.guard';
export * from './rate-limit/redis-throttler.storage';
export * from './rate-limit/decorators/dynamic-rate-limit.decorator';
export * from './rate-limit/interfaces/rate-limit-options.interface';

export * from './swagger/setup-swagger';

export * from './telemetry/interfaces/telemetry-options.interface';
export * from './telemetry/tracing';
export * from './telemetry/telemetry.service';
export * from './telemetry/telemetry.module';
export * from './telemetry/interceptors/trace-context.interceptor';
export * from './telemetry/middleware/trace-context.middleware';
export * from './telemetry/filters/trace-exception.filter';

export * from './health/health.module';
export * from './health/health.controller';
export * from './health/indicators/redis.health';
export * from './health/interfaces/health-options.interface';
