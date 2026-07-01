import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { loadEnvironment } from '@socialflow/config';

import { AppModule } from './modules/app.module.js';

const bootstrap = async (): Promise<void> => {
  const env = loadEnvironment();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: env.API_CORS_ORIGIN,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.setGlobalPrefix('api');

  await app.listen(env.API_PORT, env.API_HOST);
};

await bootstrap();
