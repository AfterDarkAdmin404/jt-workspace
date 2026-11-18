import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogService } from './audit-log.service';
import { UserActionLog } from './entities/user-action-log.entity';
import {
  AUDIT_LOG_OPTIONS,
  type AuditLogModuleOptions,
} from './interfaces/audit-log.interface';

@Module({})
export class AuditLogModule {
  static forRoot(options: AuditLogModuleOptions = {}): DynamicModule {
    return {
      module: AuditLogModule,
      global: options.isGlobal ?? true,
      imports: [TypeOrmModule.forFeature([UserActionLog])],
      providers: [
        {
          provide: AUDIT_LOG_OPTIONS,
          useValue: options,
        },
        AuditLogService,
      ],
      exports: [AuditLogService, TypeOrmModule],
    };
  }
}
