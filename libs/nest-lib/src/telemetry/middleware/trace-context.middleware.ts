import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { TelemetryService } from '../telemetry.service';

@Injectable()
export class TraceContextMiddleware implements NestMiddleware {
  use(_req: Request, res: Response, next: NextFunction): void {
    const traceId = TelemetryService.getActiveTraceId();
    if (traceId && !res.headersSent) {
      res.setHeader('X-Trace-Id', traceId);
    }
    next();
  }
}
