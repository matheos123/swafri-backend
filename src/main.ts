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

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Web3 Battle Arena API')
    .setDescription(
      [
        'Real-time Rock Paper Scissors with blockchain identity and rewards.',
        '',
        '## Auth',
        '1. `POST /auth/register` or `POST /auth/login` → save `accessToken`.',
        '2. Click **Authorize** and paste: `Bearer <accessToken>` (or token only).',
        '',
        '## Wallet (JWT required)',
        '- Login is email/password. Wallet connect links MetaMask for on-chain rewards.',
        '- Sign this exact message in MetaMask: `Connect wallet to Web3 Battle Arena`',
        '- Then `POST /wallet/connect` with `walletAddress`, `message`, `signature`.',
        '',
        '## Match play',
        'Gameplay uses **Socket.IO** on the same host (`matchmaking:join`, `game:move`).',
        'REST game routes are read-only. After a win, rewards are written to Polygon Amoy automatically if the winner has a linked wallet.',
        '',
        '## Blockchain (public GETs)',
        'Network: Polygon Amoy (`80002`). Contract: `GameReward`.',
        'Full written docs: `docs/API.md` in the repo.',
      ].join('\n'),
    )
    .setVersion('1.1')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT')
    .addTag('Auth', 'Register, login, refresh, profile')
    .addTag('Wallet', 'Link MetaMask after JWT login')
    .addTag('Blockchain', 'Read-only on-chain health, player points, and matches')
    .addTag('Game', 'Read-only room status (play via Socket.IO)')
    .addTag('Users', 'User profile listing and updates')
    .addTag('Leaderboard', 'Rankings by points')
    .addTag('Achievements', 'Achievement catalog')
    .addTag('Replay', 'Match replay and history')
    .addTag('Friends', 'Friend requests (JWT)')
    .addTag('Health', 'Service health')
    .build();

  SwaggerModule.setup(`${prefix}/docs`, app, SwaggerModule.createDocument(app, swaggerConfig), {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(port);

  const logger = new AppLogger();
  logger.log(`Server → http://localhost:${port}/${prefix}`, 'Bootstrap');
  logger.log(`Swagger → http://localhost:${port}/${prefix}/docs`, 'Bootstrap');
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
