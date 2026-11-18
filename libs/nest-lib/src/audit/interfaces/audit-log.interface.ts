export enum UserActionType {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  CHANGE_PASSWORD = 'CHANGE_PASSWORD',
  REGISTER = 'REGISTER',
  REFRESH_TOKEN = 'REFRESH_TOKEN',
}

export type UserActionInput = UserActionType | (string & {});

export interface LogUserActionDto {
  userId?: string | null;
  action: UserActionInput;
  appName?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AuditLogModuleOptions {
  appName?: string;
  failSilently?: boolean;
  isGlobal?: boolean;
}

export const AUDIT_LOG_OPTIONS = 'AUDIT_LOG_OPTIONS';
