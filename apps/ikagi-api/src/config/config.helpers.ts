import type { ConfigService } from '@nestjs/config';

/**
 * Reads a boolean-like environment variable where any value other than `'false'`
 * evaluates to `true` when `defaultValue` is `true`.
 */
export function getBooleanFlag(
  configService: ConfigService,
  key: string,
  defaultValue = true,
): boolean {
  const value = configService.get<string>(key);
  if (value === undefined || value.trim() === '') {
    return defaultValue;
  }
  return value.trim().toLowerCase() !== 'false';
}

/**
 * Reads a numeric environment variable with fallback for missing, empty, or out-of-range values.
 */
export function getNumberValue(
  configService: ConfigService,
  key: string,
  defaultValue: number,
  min?: number,
): number {
  const raw = configService.get<string>(key);
  if (raw === undefined || raw.trim() === '') {
    return defaultValue;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || (min !== undefined && parsed < min)) {
    return defaultValue;
  }
  return parsed;
}
