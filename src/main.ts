import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppLogger } from './core/logger/app.logger';
import { AllExceptionsFilter } from './core/filter/http-exception.filter';
import { LoggingInterceptor } from './core/interceptor/logging.interceptor';
import { TransformInterceptor } from './core/interceptor/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new AppLogger(),
    bufferLogs: true,
  });

  const config = app.get(ConfigService);
  const port = config.get<number>('app.port') ?? 3001;
  const prefix = config.get<string>('app.prefix') ?? 'api/v1';
  const corsOrigin = config.get<string>('app.corsOrigin') ?? 'http://localhost:3000';

  app.use(helmet({ contentSecurityPolicy: false }));
  app.enableCors({ origin: corsOrigin, credentials: true });
  app.use(compression());
  app.setGlobalPrefix(prefix);
  app.enableShutdownHooks();

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Web3 Battle Arena API')
    .setDescription('Real-time Rock Paper Scissors with blockchain identity and rewards')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT')
    .build();

  SwaggerModule.setup(`${prefix}/docs`, app, SwaggerModule.createDocument(app, swaggerConfig), {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(port);

  const logger = new AppLogger();
  logger.log(`Server → http://localhost:${port}/${prefix}`, 'Bootstrap');
  logger.log(`Swagger → http://localhost:${port}/${prefix}/docs`, 'Bootstrap');
}

bootstrap().catch((err) => { console.error(err); process.exit(1); });
