import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { BlockchainQueueProcessor } from './processors/blockchain.processor';
import { EmailQueueProcessor } from './processors/email.processor';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('redis.url');
        if (url) {
          return {
            connection: {
              url,
              ...(url.startsWith('rediss://') ? { tls: {} } : {}),
            },
          };
        }
        return {
          connection: {
            host: config.get<string>('redis.host') ?? 'localhost',
            port: config.get<number>('redis.port') ?? 6379,
            password: config.get<string>('redis.password'),
          },
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: 'blockchain' },
      { name: 'email' },
    ),
  ],
  controllers: [QueueController],
  providers: [
    QueueService,
    BlockchainQueueProcessor,
    EmailQueueProcessor,
  ],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
