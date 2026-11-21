import { ConfigModule, ConfigService } from '@nestjs/config';
import type { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { SHARED_ENTITIES, UserActionLog } from '@jt-workspace/nest-lib';
import { getNumberValue } from './config.helpers';

const DEFAULT_DB_PORT = 5432;

export const databaseConfig: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    type: 'postgres',
    host: configService.get<string>('DB_HOST', 'localhost'),
    port: getNumberValue(configService, 'DB_PORT', DEFAULT_DB_PORT, 1),
    username: configService.get<string>('DB_USERNAME', 'postgres'),
    password: configService.get<string>('DB_PASSWORD', 'root'),
    database: configService.get<string>('DB_NAME', 'db_ikag'),
    entities: [...new Set([...SHARED_ENTITIES, UserActionLog])],
    synchronize: false,
  }),
};
