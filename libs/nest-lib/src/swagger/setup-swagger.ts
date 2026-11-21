import { type INestApplication, Logger } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import type { ConfigService } from '@nestjs/config';
import { ModulesContainer } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export interface SwaggerServiceOptions {
  name: string;
  title?: string;
  description?: string;
}

export interface SetupSwaggerOptions {
  defaultTitle?: string;
  defaultDescription?: string;
}

const SWAGGER_SERVICE_METADATA = 'swagger:service';

export function SwaggerService(options: SwaggerServiceOptions): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(SWAGGER_SERVICE_METADATA, options, target);
  };
}

type Type<T = unknown> = new (...args: unknown[]) => T;

function getServiceRouteName(
  moduleMetatype: Function,
  controllers: Iterable<{ metatype: Function | Type<unknown> | null }>,
): SwaggerServiceOptions | null {
  const explicit = Reflect.getMetadata(
    SWAGGER_SERVICE_METADATA,
    moduleMetatype,
  ) as SwaggerServiceOptions | undefined;
  if (explicit?.name) {
    return explicit;
  }

  for (const wrapper of controllers) {
    if (!wrapper.metatype || typeof wrapper.metatype !== 'function') continue;
    const rawPath = Reflect.getMetadata(PATH_METADATA, wrapper.metatype) as
      string | undefined;
    if (!rawPath || rawPath === '/') continue;

    const firstSegment = rawPath.replace(/^\/+/, '').split('/')[0];
    if (firstSegment) {
      const label =
        firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1);
      return {
        name: firstSegment,
        title: `${label} API`,
        description: `${label} service endpoints`,
      };
    }
  }

  return null;
}

export function setupSwagger(
  app: INestApplication,
  configService: ConfigService,
  port: number,
  options: SetupSwaggerOptions = {},
): void {
  const swaggerEnabled =
    configService.get<string>('SWAGGER_ENABLED', 'true') !== 'false';
  if (!swaggerEnabled) {
    return;
  }

  const docsBasePath = configService
    .get<string>('SWAGGER_DOCS_PATH', 'docs')
    .replace(/^\/+|\/+$/g, '');
  const swaggerTitle = configService.get<string>(
    'SWAGGER_TITLE',
    options.defaultTitle ?? 'API - Core Services',
  );
  const swaggerVersion = configService.get<string>('SWAGGER_VERSION', '1.0.0');

  const modulesContainer = app.get(ModulesContainer);
  const registeredServices = new Map<
    string,
    { uiPath: string; jsonPath: string }
  >();

  // Register /docs/<service> and /docs/<service>-json before /docs so sub-paths match first
  for (const moduleRef of modulesContainer.values()) {
    if (moduleRef.controllers.size === 0) continue;

    const serviceMeta = getServiceRouteName(
      moduleRef.metatype,
      moduleRef.controllers.values(),
    );
    if (!serviceMeta || registeredServices.has(serviceMeta.name)) continue;

    const uiPath = `${docsBasePath}/${serviceMeta.name}`;
    const jsonPath = `${docsBasePath}/${serviceMeta.name}-json`;

    const serviceConfig = new DocumentBuilder()
      .setTitle(serviceMeta.title ?? `${serviceMeta.name} API`)
      .setDescription(
        serviceMeta.description ?? `${serviceMeta.name} service endpoints`,
      )
      .setVersion(swaggerVersion)
      .addBearerAuth()
      .build();

    const serviceDocument = SwaggerModule.createDocument(app, serviceConfig, {
      include: [moduleRef.metatype],
    });

    SwaggerModule.setup(uiPath, app, serviceDocument, {
      useGlobalPrefix: false,
      jsonDocumentUrl: jsonPath,
      swaggerOptions: {
        persistAuthorization: true,
      },
    });

    registeredServices.set(serviceMeta.name, { uiPath, jsonPath });
  }

  const mainConfig = new DocumentBuilder()
    .setTitle(swaggerTitle)
    .setDescription(options.defaultDescription ?? 'Full API documentation')
    .setVersion(swaggerVersion)
    .addBearerAuth()
    .build();

  const mainDocument = SwaggerModule.createDocument(app, mainConfig);
  SwaggerModule.setup(docsBasePath, app, mainDocument, {
    useGlobalPrefix: false,
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const serviceLogs = [...registeredServices.entries()]
    .map(
      ([name, { uiPath, jsonPath }]) =>
        `${name}: http://localhost:${port}/${uiPath} (JSON: http://localhost:${port}/${jsonPath})`,
    )
    .join(' | ');

  Logger.log(
    `📚 Swagger UI: http://localhost:${port}/${docsBasePath}${serviceLogs ? ` | ${serviceLogs}` : ''}`,
  );
}
