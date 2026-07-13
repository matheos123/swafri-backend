import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import appConfig from './core/config/index';
import { PrismaModule } from './prisma/prisma.module';
import { Web3Module } from './core/provider/web3.module';
import { RedisModule } from './core/redis/redis.module';
import { QueueModule } from './core/queue/queue.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { GameModule } from './modules/game/game.module';
import { MatchmakingModule } from './modules/matchmaking/matchmaking.module';
import { ChatModule } from './modules/chat/chat.module';
import { LeaderboardModule } from './modules/leaderboard/leaderboard.module';
import { AchievementModule } from './modules/achievement/achievement.module';
import { ReplayModule } from './modules/replay/replay.module';
import { FriendModule } from './modules/friend/friend.module';
import { NotificationModule } from './modules/notification/notification.module';
import { HealthModule } from './modules/health/health.module';
import { VerifyModule } from './modules/verify/verify.module';
import { SquadModule } from './modules/squad/squad.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        PORT: Joi.number().default(3001),
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        JWT_REFRESH_SECRET: Joi.string().required(),
        REDIS_HOST: Joi.string().default('localhost'),
        REDIS_PORT: Joi.number().default(6379),
        REDIS_URL: Joi.string().optional(),
        CORS_ORIGIN: Joi.string().default('http://localhost:3000'),
        SOCKET_CORS_ORIGIN: Joi.string().default('http://localhost:3000'),
        BLOCKCHAIN_RPC_URL: Joi.string().optional(),
        PRIVATE_KEY: Joi.string().optional(),
        BATTLE_ARENA_ADDRESS: Joi.string().optional(),
        ACHIEVEMENT_NFT_ADDRESS: Joi.string().optional(),
        ARENA_TOKEN_ADDRESS: Joi.string().optional(),
        PLAYER_PROFILE_ADDRESS: Joi.string().optional(),
      }),
      validationOptions: { abortEarly: false },
    }),
    PrismaModule,
    Web3Module,
    RedisModule,
    QueueModule,
    AuthModule,
    UserModule,
    WalletModule,
    GameModule,
    MatchmakingModule,
    ChatModule,
    LeaderboardModule,
    AchievementModule,
    ReplayModule,
    FriendModule,
    NotificationModule,
    HealthModule,
    VerifyModule,
    SquadModule,
  ],
})
export class AppModule {}
