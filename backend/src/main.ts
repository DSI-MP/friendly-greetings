import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import { join } from 'path';
import { existsSync } from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: ['error', 'warn', 'log'],
    });

    app.use(json({ limit: '10mb' }));
    app.use(urlencoded({ extended: true, limit: '10mb' }));

    const config = app.get(ConfigService);
    const port = config.get<number>('port', 3000);
    const apiPrefix = config.get<string>('apiPrefix', '/api');
    const allowCors = config.get<boolean>('cors.allow', true);
    const corsOrigin = config.get<string>('cors.origin', '*');
    const enableSwagger = config.get<boolean>('swagger.enabled', true);

    app.setGlobalPrefix(apiPrefix);

    // Disable etag for API responses to prevent 304 cache issues
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.set('etag', false);

    // Security headers + no-cache for API routes
    app.use((_req: any, res: any, next: any) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

      // Prevent caching of API responses (authenticated dynamic data)
      if (_req.url?.startsWith(apiPrefix)) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
        res.setHeader('Vary', 'Authorization');
      }

      next();
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    if (allowCors) {
      app.enableCors({
        origin: corsOrigin === '*' ? true : corsOrigin.split(','),
        credentials: true,
        methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      });
    }

    if (enableSwagger) {
      const swaggerConfig = new DocumentBuilder()
        .setTitle('Transport Management API')
        .setDescription('Enterprise Employee Overtime Transport Management System')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
      const document = SwaggerModule.createDocument(app, swaggerConfig);
      SwaggerModule.setup(`${apiPrefix}/docs`, app, document);
      logger.log(`Swagger docs available at ${apiPrefix}/docs`);
    }

    const frontendPath = join(__dirname, '..', 'frontend-dist');
    logger.log(`Resolved frontend path: ${frontendPath}`);

    if (existsSync(frontendPath)) {
      app.useStaticAssets(frontendPath);
      logger.log(`Serving frontend from ${frontendPath}`);

      const express = app.getHttpAdapter().getInstance();
      express.get(/^\/(?!api).*/, (_req, res) => {
        res.sendFile(join(frontendPath, 'index.html'));
      });
    } else {
      logger.warn(`Frontend build not found at ${frontendPath}. Skipping static file serving.`);
    }

    const server = await app.listen(port, '0.0.0.0');
    // 10 min timeout for long-running requests like bulk upload
    server.setTimeout(10 * 60 * 1000);
    logger.log(`Application running on 0.0.0.0:${port} with prefix ${apiPrefix} (timeout: 10min)`);
  } catch (error) {
    const logger = new Logger('Bootstrap');
    logger.error(`Failed to start application: ${error.message}`, error.stack);
    process.exit(1);
  }
}

bootstrap();
