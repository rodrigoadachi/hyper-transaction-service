import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { setupSwagger } from './config/swagger.config';
import { DomainExceptionFilter } from './shared/infrastructure/filters/domain-exception.filter';

const PORT = process.env.API_PORT ?? 3333;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new DomainExceptionFilter());

  const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  setupSwagger(app, PORT);

  await app.listen(PORT);
  const logger = app.get(Logger);
  logger.log(`Starting API on port ${PORT}...`, 'Bootstrap');
  if (process.env.NODE_ENV !== 'production') {
    logger.log(`Swagger docs → http://localhost:${PORT}/docs`, 'Bootstrap');
  }
}

bootstrap();
