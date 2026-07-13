import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { Web3Provider } from '../../provider/web3.provider';
import { BlockchainJobData } from '../queue.service';

@Processor('blockchain')
export class BlockchainQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(BlockchainQueueProcessor.name);

  constructor(private readonly web3: Web3Provider) {
    super();
  }

  async process(job: Job<BlockchainJobData>): Promise<any> {
    this.logger.log(`Processing blockchain job: ${job.name} | ID: ${job.id}`);

    try {
      switch (job.data.type) {
        case 'record-match':
          return await this.recordMatch(job.data);
        
        case 'mint-badge':
          return await this.mintBadge(job.data);
        
        default:
          throw new Error(`Unknown blockchain job type: ${job.data.type}`);
      }
    } catch (error) {
      this.logger.error(
        `Blockchain job failed: ${job.name} | ID: ${job.id} | Attempt: ${job.attemptsMade}/${job.opts.attempts}`,
        error,
      );
      throw error; // Re-throw to trigger BullMQ retry
    }
  }

  private async recordMatch(data: BlockchainJobData): Promise<string> {
    const { matchId, winnerId, loserId, onChainHash } = data;
    
    if (!matchId || !onChainHash) {
      throw new Error('Missing required fields for record-match job');
    }

    const txHash = await this.web3.recordMatchOnChain(
      matchId,
      winnerId ?? null,
      loserId ?? null,
      onChainHash
    );
    
    this.logger.log(
      `Match recorded on-chain: ${matchId} | TxHash: ${txHash}`,
    );
    
    return txHash;
  }

  private async mintBadge(data: BlockchainJobData): Promise<string> {
    const { playerAddress, badgeName } = data;
    
    if (!playerAddress || !badgeName) {
      throw new Error('Missing required fields for mint-badge job');
    }

    const txHash = await this.web3.mintBadgeOnChain(playerAddress, badgeName);
    
    this.logger.log(
      `Badge minted on-chain: "${badgeName}" for ${playerAddress} | TxHash: ${txHash}`,
    );
    
    return txHash;
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<BlockchainJobData>, result: any) {
    this.logger.log(
      `✅ Blockchain job completed: ${job.name} | ID: ${job.id} | Result: ${result}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<BlockchainJobData> | undefined, error: Error) {
    if (job) {
      this.logger.error(
        `❌ Blockchain job failed permanently: ${job.name} | ID: ${job.id} | Attempts: ${job.attemptsMade}`,
        error.stack,
      );
    } else {
      this.logger.error('❌ Blockchain job failed with unknown job', error.stack);
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job<BlockchainJobData>) {
    this.logger.log(
      `🔄 Blockchain job started: ${job.name} | ID: ${job.id} | Attempt: ${job.attemptsMade + 1}/${job.opts.attempts}`,
    );
  }
}
