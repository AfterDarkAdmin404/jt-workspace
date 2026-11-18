import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app/app.module';
import { AuthApiModule as AuthModule } from './auth/auth-api.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', 1);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix, {
    exclude: [{ path: '/', method: RequestMethod.GET }],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  );

  const configService = app.get(ConfigService);
  const swaggerEnabled =
    configService.get<string>('SWAGGER_ENABLED', 'true') !== 'false';
  const swaggerDocsPath = configService
    .get<string>('SWAGGER_DOCS_PATH', 'docs')
    .replace(/^\/+/, '');
  const swaggerAuthPath = configService
    .get<string>('SWAGGER_AUTH_PATH', 'docs/auth')
    .replace(/^\/+/, '');
  const swaggerAuthJsonPath = configService
    .get<string>('SWAGGER_AUTH_JSON_PATH', 'docs/auth-json')
    .replace(/^\/+/, '');

  if (swaggerEnabled) {
    const swaggerTitle = configService.get<string>(
      'SWAGGER_TITLE',
      'Ikagi API - Auth & Core Services'
    );
    const swaggerVersion = configService.get<string>('SWAGGER_VERSION', '1.0.0');

    // Register /docs/auth and /docs/auth-json before /docs so sub-paths match first
    const authConfig = new DocumentBuilder()
      .setTitle('Ikagi Auth API')
      .setDescription('Authentication & OAuth endpoints')
      .setVersion(swaggerVersion)
      .addBearerAuth()
      .build();

    const authDocument = SwaggerModule.createDocument(app, authConfig, {
      include: [AuthModule],
    });

    SwaggerModule.setup(swaggerAuthPath, app, authDocument, {
      useGlobalPrefix: false,
      jsonDocumentUrl: swaggerAuthJsonPath,
      swaggerOptions: {
        persistAuthorization: true,
      },
    });

    const mainConfig = new DocumentBuilder()
      .setTitle(swaggerTitle)
      .setDescription('Full Ikagi API documentation')
      .setVersion(swaggerVersion)
      .addBearerAuth()
      .build();

    const mainDocument = SwaggerModule.createDocument(app, mainConfig);

    SwaggerModule.setup(swaggerDocsPath, app, mainDocument, {
      useGlobalPrefix: false,
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  const port = Number(configService.get<string>('PORT', '3000')) || 3000;
  await app.listen(port);

  // Set when Nx waits for this server to be ready
  if (process.env.NX_READY_SIGNAL_SOCKET) {
    try {
      // Function keeps TypeScript and bundlers from rewriting or bundling the import
      const load = new Function('s', 'return import(s)') as (
        s: string
      ) => Promise<{ emitReadySignal(server: unknown): boolean }>;
      (await load('@nx/js/ready-signal')).emitReadySignal(app.getHttpServer());
    } catch {
      // @nx/js isn't installed
    }
  }

  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
  );
  if (swaggerEnabled) {
    Logger.log(
      `📚 Swagger UI: http://localhost:${port}/${swaggerDocsPath} | Auth: http://localhost:${port}/${swaggerAuthPath} (JSON: http://localhost:${port}/${swaggerAuthJsonPath})`
    );
  }
}

bootstrap();
