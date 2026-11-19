import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { UserActionLog } from './entities/user-action-log.entity';
import {
  AUDIT_LOG_OPTIONS,
  type AuditLogModuleOptions,
  type LogUserActionDto,
  type UserActionInput,
} from './interfaces/audit-log.interface';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(UserActionLog)
    private readonly auditLogRepo: Repository<UserActionLog>,
    @Optional()
    @Inject(AUDIT_LOG_OPTIONS)
    private readonly options?: AuditLogModuleOptions,
  ) {}

  async logAction(payload: LogUserActionDto): Promise<UserActionLog | null> {
    const rawAction = payload.action;
    if (typeof rawAction !== 'string' || !rawAction.trim()) {
      const error = new Error('Audit log action must be a non-empty string');
      if (this.options?.failSilently !== false) {
        this.logger.warn(error.message);
        return null;
      }
      throw error;
    }

    const normalizedAction = rawAction.trim().toUpperCase();

    try {
      const entry = this.auditLogRepo.create({
        userId: payload.userId ?? null,
        appName:
          payload.appName ??
          this.options?.appName ??
          process.env.APP_NAME ??
          null,
        action: normalizedAction,
        ipAddress: payload.ipAddress ?? null,
        userAgent: payload.userAgent ?? null,
        metadata: payload.metadata ?? null,
      });

      return await this.auditLogRepo.save(entry);
    } catch (err) {
      this.logger.error(
        `Failed to persist audit log for action "${normalizedAction}"`,
        err instanceof Error ? err.stack : String(err),
      );
      if (this.options?.failSilently !== false) {
        return null;
      }
      throw err;
    }
  }

  async logFromRequest(
    req: Request,
    userId: string | null,
    action: UserActionInput,
    metadata?: Record<string, unknown>,
  ): Promise<UserActionLog | null> {
    return this.logAction({
      userId,
      action,
      ipAddress: this.extractClientIp(req),
      userAgent: req.headers['user-agent'] ?? null,
      metadata,
    });
  }

  private extractClientIp(req: Request): string | null {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
      const firstHop = forwardedFor.split(',')[0]?.trim();
      if (firstHop) return firstHop;
    } else if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
      const firstHop = forwardedFor[0]?.split(',')[0]?.trim();
      if (firstHop) return firstHop;
    }

    return req.ip ?? null;
  }
}
