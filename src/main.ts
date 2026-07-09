import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AppLogger } from './core/logger/app.logger';
import { AllExceptionsFilter } from './core/filter/http-exception.filter';
import { LoggingInterceptor } from './core/interceptor/logging.interceptor';
import { TransformInterceptor } from './core/interceptor/transform.interceptor';

async function bootstrap() {
  // Use NestExpressApplication so app.set() is available for trust proxy
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new AppLogger(),
    bufferLogs: true,
  });

  const config = app.get(ConfigService);
  const port       = config.get<number>('app.port')       ?? 3001;
  const prefix     = config.get<string>('app.prefix')     ?? 'api/v1';
  const corsOrigin = config.get<string>('app.corsOrigin') ?? 'http://localhost:3000';

  // Trust the reverse proxy (Render, Railway, Heroku, etc.)
  // Ensures Express sees correct protocol (https) so secure cookies work
  // correctly behind the load balancer.
  app.set('trust proxy', 1);

  // Support multiple comma-separated allowed origins
  // Set CORS_ORIGIN=https://your-app.vercel.app,http://localhost:3000 in env
  const allowedOrigins = corsOrigin.split(',').map((o) => o.trim());

  app.use(helmet({ contentSecurityPolicy: false }));
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (Postman, mobile apps, curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  });
  app.use(compression());
  app.use(cookieParser());
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
