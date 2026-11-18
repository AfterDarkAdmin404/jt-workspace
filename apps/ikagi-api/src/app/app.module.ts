import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AuditLogModule,
  AuthModule,
  DynamicRateLimitModule,
  parseRateLimitProfiles,
  RedisCacheModule,
  SHARED_ENTITIES,
  UserActionLog,
} from '@jt-workspace/nest-lib';
import { AuthApiModule } from '../auth/auth-api.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        'apps/ikagi-api/.env.dev',
        'apps/ikagi-api/.env',
        '.env.dev',
        '.env',
      ],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: Number(configService.get<string>('DB_PORT', '5432')),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'root'),
        database: configService.get<string>('DB_NAME', 'db_ikag'),
        entities: [...new Set([...SHARED_ENTITIES, UserActionLog])],
        synchronize: false,
      }),
    }),
    AuditLogModule.forRoot({
      appName: 'ikagi-api',
      isGlobal: true,
    }),
    RedisCacheModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        enabled: configService.get<string>('REDIS_ENABLED', 'true') !== 'false',
        host: configService.get<string>('REDIS_HOST', 'localhost'),
        port: Number(configService.get<string>('REDIS_PORT', '6379')),
        username: configService.get<string>('REDIS_USERNAME') || undefined,
        password: configService.get<string>('REDIS_PASSWORD') || undefined,
        db: Number(configService.get<string>('REDIS_DB', '0')),
        keyPrefix: configService.get<string>('REDIS_KEY_PREFIX', 'ikagi:'),
        ttl: Number(configService.get<string>('REDIS_TTL', '300')) * 1000,
      }),
    }),
    DynamicRateLimitModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        enabled:
          configService.get<string>('RATE_LIMIT_ENABLED', 'true') !== 'false',
        defaultTtl: Number(
          configService.get<string>('RATE_LIMIT_DEFAULT_TTL', '60')
        ),
        defaultLimit: Number(
          configService.get<string>('RATE_LIMIT_DEFAULT_LIMIT', '100')
        ),
        profiles: parseRateLimitProfiles(
          configService.get<string>('RATE_LIMIT_PROFILES')
        ),
        redis: {
          enabled:
            configService.get<string>('REDIS_ENABLED', 'true') !== 'false',
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: Number(configService.get<string>('REDIS_PORT', '6379')),
          username: configService.get<string>('REDIS_USERNAME') || undefined,
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
          db: Number(configService.get<string>('REDIS_DB', '0')),
          keyPrefix: configService.get<string>('REDIS_KEY_PREFIX', 'ikagi:'),
        },
      }),
    }),
    AuthModule.forRootAsync(),
    AuthApiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
