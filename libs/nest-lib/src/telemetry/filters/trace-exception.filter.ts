import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { TelemetryService } from '../telemetry.service';

@Catch()
export class TraceExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(TraceExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      throw exception;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const traceId = TelemetryService.getActiveTraceId();

    if (traceId && !response.headersSent) {
      response.setHeader('X-Trace-Id', traceId);
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        response.status(status).json({
          ...exceptionResponse,
          ...(traceId ? { traceId } : {}),
        });
        return;
      }

      response.status(status).json({
        statusCode: status,
        message: exceptionResponse,
        ...(traceId ? { traceId } : {}),
      });
      return;
    }

    const traceLabel = traceId ? ` [traceId=${traceId}]` : '';
    this.logger.error(
      `Unhandled exception on ${request.method} ${request.url}${traceLabel}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      ...(traceId ? { traceId } : {}),
    });
  }
}
