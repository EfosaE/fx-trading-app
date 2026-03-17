import { NestFactory } from '@nestjs/core';
import { Response } from 'express';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  // API versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global API prefix
  app.setGlobalPrefix('api');

  // Root redirect to Swagger docs
  app.getHttpAdapter().get('/', (req, res: Response) => {
    res.redirect('/api/v1/docs');
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('FX Trading API')
    .setDescription('Backend Documentation for FX Trading App')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT token',
        in: 'header',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // Swagger UI → /docs
  SwaggerModule.setup('api/v1/docs', app, document);
  app.useLogger(app.get(Logger));
  await app.listen(process.env.PORT ?? 3000);

  const logger = app.get(Logger);
  const url = await app.getUrl();

  logger.log(`App running at: ${url}`);
  logger.log(`Swagger docs at: ${url}/api/v1/docs`);
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed', err);
  process.exit(1);
});
