import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import 'reflect-metadata';
import { AppModule } from './app.module';
import { logErrorSafely, logSafely } from './common/logging/error-logging';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule, { abortOnError: false });
    app.useWebSocketAdapter(new WsAdapter(app));
    app.enableShutdownHooks();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        exceptionFactory: (errors) => {
          const validationErrors = errors.map((error) => {
            const [constraint, message] = Object.entries(
              error.constraints ?? {},
            )[0];

            return {
              field: error.property,
              code: `${error.property.toUpperCase()}_${constraint.toUpperCase()}`,
              message,
            };
          });

          return new BadRequestException({
            statusCode: 400,
            errors: validationErrors,
          });
        },
      }),
    );

    const port = process.env.PORT ?? 3000;
    await app.listen(port, '0.0.0.0');
    logSafely(
      logger,
      'log',
      `operation=server.listen outcome=started port=${port}`,
    );
  } catch (error: unknown) {
    logErrorSafely(logger, 'operation=server.bootstrap outcome=error', error);
    throw error;
  }
}

void bootstrap().catch(() => {
  process.exitCode = 1;
});
