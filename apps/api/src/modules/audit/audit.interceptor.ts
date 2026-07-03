import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { catchError, tap, throwError } from 'rxjs';

import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../auth/types.js';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        void this.writeAuditLog(request, 'SUCCESS', Date.now() - startedAt);
      }),
      catchError((error: unknown) => {
        void this.writeAuditLog(request, 'FAILED', Date.now() - startedAt, error);
        return throwError(() => error);
      }),
    );
  }

  private async writeAuditLog(
    request: Request & { user?: AuthenticatedUser },
    result: 'SUCCESS' | 'FAILED',
    durationMs: number,
    error?: unknown,
  ): Promise<void> {
    const path = request.originalUrl;

    if (path.startsWith('/api/health')) {
      return;
    }

    try {
      await this.prisma.auditLog.create({
        data: {
          userId: request.user?.id,
          ipAddress: this.ipAddress(request),
          userAgent: request.headers['user-agent'],
          browser: request.headers['user-agent'],
          action: `${request.method} ${path}`,
          result,
          metadata: {
            durationMs,
            status: result,
            error: error instanceof Error ? error.message : undefined,
          },
        },
      });
    } catch {
      // Audit logging must never break the user's request path.
    }
  }

  private ipAddress(request: Request): string | undefined {
    const forwardedFor = request.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string') {
      return forwardedFor.split(',')[0]?.trim();
    }

    return request.ip;
  }
}
