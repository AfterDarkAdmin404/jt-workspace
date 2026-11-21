import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AuditLogModule,
  AuthModule,
  DynamicRateLimitModule,
  HealthModule,
  OrgNestLibModule,
  RedisCacheModule,
  TelemetryModule,
} from '@jt-workspace/nest-lib';
import { AuthApiModule } from '../auth/auth-api.module';
import {
  auditLogConfig,
  authConfig,
  configModuleOptions,
  databaseConfig,
  healthConfig,
  rateLimitConfig,
  redisCacheConfig,
  telemetryConfig,
} from '../config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot(configModuleOptions),
    TypeOrmModule.forRootAsync(databaseConfig),
    AuditLogModule.forRoot(auditLogConfig),
    TelemetryModule.forRoot(telemetryConfig),
    RedisCacheModule.forRootAsync(redisCacheConfig),
    DynamicRateLimitModule.forRootAsync(rateLimitConfig),
    AuthModule.forRootAsync(authConfig),
    HealthModule.forRootAsync(healthConfig),
    AuthApiModule,
    OrgNestLibModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
