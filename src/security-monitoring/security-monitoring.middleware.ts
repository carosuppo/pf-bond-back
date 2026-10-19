import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { SecurityEventType } from '@prisma/client';
import { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../user/interface/authenticated-request.interface';
import { logErrorSafely, logSafely } from '../common/logging/error-logging';
import {
  ObservedSecurityEvent,
  SecurityMonitoringService,
} from './security-monitoring.service';

@Injectable()
export class SecurityMonitoringMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecurityMonitoringMiddleware.name);

  constructor(
    private readonly securityMonitoringService: SecurityMonitoringService,
  ) {}

  use(
    request: AuthenticatedRequest,
    response: Response,
    next: NextFunction,
  ): void {
    response.once('finish', () => {
      if (response.statusCode === 403) {
        this.logForbiddenRequest(request);
      }

      const event = this.detectEvent(request, response.statusCode);
      if (!event) return;

      void this.securityMonitoringService
        .record(event)
        .catch((error: unknown) => {
          logErrorSafely(
            this.logger,
            'operation=recordSecurityEvent outcome=error',
            error,
          );
        });
    });

    next();
  }

  private logForbiddenRequest(request: AuthenticatedRequest): void {
    const routePath = (
      request.route as unknown as { path?: unknown } | undefined
    )?.path;
    const segments = typeof routePath === 'string' ? routePath.split('/') : [];
    const routeSegments = segments.filter((segment) => segment.length > 0);
    const firstSegment = routeSegments[0]?.replace(/[^A-Za-z0-9_.-]/g, '');
    const moduleName = firstSegment
      ? `${firstSegment[0].toUpperCase()}${firstSegment.slice(1)}`
      : 'HttpRequest';
    const operationPath = routeSegments
      .map((segment) =>
        segment.startsWith(':')
          ? 'param'
          : segment.replace(/[^A-Za-z0-9_.-]/g, ''),
      )
      .filter((segment) => segment.length > 0)
      .join('/');
    const method = request.method.toUpperCase();

    logSafely(
      this.logger,
      'warn',
      `module=${moduleName} operation=${method}_${operationPath || 'unmatched'} status=403`,
    );
  }

  private detectEvent(
    request: AuthenticatedRequest,
    statusCode: number,
  ): ObservedSecurityEvent | null {
    const method = request.method.toUpperCase();
    const path = this.normalizePath(request.originalUrl);
    const baseEvent = {
      ip: request.ip || request.socket.remoteAddress || null,
      userId: request.user?.id ?? null,
      method,
      path,
      statusCode,
    };

    if (method === 'POST' && path === '/user/login' && statusCode === 401) {
      return {
        ...baseEvent,
        type: SecurityEventType.AUTH_LOGIN_FAILED,
        loginEmail: this.readLoginEmail(request.body),
      };
    }

    if (!this.isLocationPath(path)) return null;

    if (statusCode === 401) {
      return {
        ...baseEvent,
        type: SecurityEventType.LOCATION_UNAUTHORIZED,
      };
    }

    if (statusCode === 403 && this.isGroupLocationPath(path)) {
      return {
        ...baseEvent,
        type: SecurityEventType.LOCATION_FORBIDDEN,
      };
    }

    return null;
  }

  private normalizePath(originalUrl: string): string {
    const path = originalUrl.split('?', 1)[0] || '/';
    return path.length > 1 ? path.replace(/\/+$/, '') : path;
  }

  private isLocationPath(path: string): boolean {
    return path === '/location' || path.startsWith('/location/');
  }

  private isGroupLocationPath(path: string): boolean {
    return /^\/location\/group\/[^/]+(?:\/|$)/.test(path);
  }

  private readLoginEmail(body: unknown): string | undefined {
    if (typeof body !== 'object' || body === null || !('email' in body)) {
      return undefined;
    }

    const email = body.email;
    return typeof email === 'string' ? email : undefined;
  }
}
