import * as dotenv from 'dotenv';
import { join, resolve } from 'path';
import {
  CreateUserActionLogsTable1794990000000,
  SHARED_ENTITIES,
  SHARED_MIGRATIONS,
  UserActionLog,
} from '@jt-workspace/nest-lib';
import { DataSource, DataSourceOptions } from 'typeorm';

dotenv.config({ path: resolve(__dirname, '../../.env') });

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'root',
  database: process.env.DB_NAME ?? 'db_ikag',
  entities: [
    join(__dirname, '..', '**', '*.entity.{ts,js}'),
    ...new Set([...SHARED_ENTITIES, UserActionLog]),
  ],
  migrations: [
    join(__dirname, 'migrations', '*.{ts,js}'),
    ...new Set([...SHARED_MIGRATIONS, CreateUserActionLogsTable1794990000000]),
  ],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
};

const AppDataSource = new DataSource(dataSourceOptions);

export default AppDataSource;
