import { Module } from '@nestjs/common';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { RewardService } from './service/reward.service';

@Module({
  imports: [BlockchainModule],
  providers: [RewardService],
  exports: [RewardService],
})
export class RewardModule {}
