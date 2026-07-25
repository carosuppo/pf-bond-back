import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}

bootstrap();
