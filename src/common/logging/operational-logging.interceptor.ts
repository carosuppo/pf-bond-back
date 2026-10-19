import {
  CallHandler,
  ExecutionContext,
  HttpException,
  InternalServerErrorException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { catchError, Observable, throwError } from 'rxjs';
import { logErrorSafely } from './error-logging';

@Injectable()
export class OperationalLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(OperationalLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const moduleName = context.getClass().name;
    const operation = context.getHandler().name;

    return next.handle().pipe(
      catchError((error: unknown) => {
        if (context.getType() === 'http') {
          if (!(error instanceof HttpException)) {
            logErrorSafely(
              this.logger,
              `module=${moduleName} operation=${operation} status=500`,
              error,
            );
            return throwError(
              () => new InternalServerErrorException('Internal server error'),
            );
          }

          const status = error.getStatus();

          if (moduleName === 'HealthController' && status === 503) {
            return throwError(() => error);
          }

          if (status >= 500) {
            logErrorSafely(
              this.logger,
              `module=${moduleName} operation=${operation} status=${status}`,
              error,
            );
          }
        }

        return throwError(() => error);
      }),
    );
  }
}
