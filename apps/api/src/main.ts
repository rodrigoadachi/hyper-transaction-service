import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { setupSwagger } from './config/swagger.config';

const PORT = process.env.PORT ?? 3333;

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);

  setupSwagger(app, PORT);

  await app.listen(PORT);
  logger.log(`Starting API on port ${PORT}...`);
  if (process.env.NODE_ENV !== 'production') {
    logger.log(`Swagger docs → http://localhost:${PORT}/docs`);
  }
}
bootstrap();
