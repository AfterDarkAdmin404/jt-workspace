import type { ConfigModuleOptions } from '@nestjs/config';

export const APP_NAME = 'ikagi-api';

export const ENV_FILE_PATHS = [
  'apps/ikagi-api/.env.dev',
  'apps/ikagi-api/.env',
  '.env.dev',
  '.env',
];

export const configModuleOptions: ConfigModuleOptions = {
  isGlobal: true,
  envFilePath: ENV_FILE_PATHS,
};
