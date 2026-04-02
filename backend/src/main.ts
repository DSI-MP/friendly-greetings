import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import { join } from 'path';
import { existsSync } from 'fs';
import helmet from 'helmet';
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
    const nodeEnv = config.get<string>('nodeEnv', 'development');
    const isProduction = nodeEnv === 'production';

    // ── JWT secret validation ──
    const jwtSecret = config.get<string>('jwt.secret', '');
    if (!jwtSecret || jwtSecret === '') {
      logger.error('FATAL: JWT_SECRET environment variable is not set. Refusing to start in production.');
      process.exit(1);
    }
    if (isProduction && jwtSecret === 'dev-only-change-me') {
      logger.error('FATAL: JWT_SECRET is using the development fallback in production. Set a strong secret.');
      process.exit(1);
    }

    app.setGlobalPrefix(apiPrefix);

    // Disable etag for API responses to prevent 304 cache issues
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.set('etag', false);

    // ── Helmet security headers ──
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
            imgSrc: ["'self'", 'data:', 'blob:', 'https://*.amazonaws.com', 'https://*.tile.openstreetmap.org'],
            connectSrc: ["'self'", 'https://*.amazonaws.com', 'https://*.geo.amazonaws.com', 'https://*.execute-api.amazonaws.com'],
            workerSrc: ["'self'", 'blob:'],
            childSrc: ["'self'", 'blob:'],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
          },
        },
        crossOriginEmbedderPolicy: false, // needed for map tiles
        crossOriginResourcePolicy: { policy: 'cross-origin' }, // needed for map tiles
      }),
    );

    // No-cache for API routes (keep existing behavior)
    app.use((_req: any, res: any, next: any) => {
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

    // ── CORS hardening ──
    if (allowCors) {
      if (isProduction && corsOrigin === '*') {
        logger.warn('CORS_ORIGIN is "*" in production. Set explicit origins via CORS_ORIGIN env var.');
      }
      const origin = isProduction
        ? (corsOrigin === '*' ? false : corsOrigin.split(',').map(o => o.trim()))
        : (corsOrigin === '*' ? true : corsOrigin.split(',').map(o => o.trim()));

      app.enableCors({
        origin,
        credentials: true,
        methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
      });
    }

    // ── Swagger (disabled in production by default) ──
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
    } else {
      logger.log('Swagger is disabled (production default). Set ENABLE_SWAGGER=true to enable.');
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
    logger.log(`Application running on 0.0.0.0:${port} with prefix ${apiPrefix} (timeout: 10min, env: ${nodeEnv})`);
  } catch (error) {
    const logger = new Logger('Bootstrap');
    logger.error(`Failed to start application: ${error.message}`, error.stack);
    process.exit(1);
  }
}

bootstrap();
