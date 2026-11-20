import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import type { Observable } from 'rxjs';
import { TelemetryService } from '../telemetry.service';

@Injectable()
export class TraceContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() === 'http') {
      const traceId = TelemetryService.getActiveTraceId();
      if (traceId) {
        const response = context.switchToHttp().getResponse<Response>();
        if (!response.headersSent) {
          response.setHeader('X-Trace-Id', traceId);
        }
      }
    }

    return next.handle();
  }
}
