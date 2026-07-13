import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export interface BlockchainJobData {
  type: 'record-match' | 'mint-badge';
  matchId?: string;
  winnerId?: string | null;
  loserId?: string | null;
  onChainHash?: string;
  playerAddress?: string;
  badgeName?: string;
}

export interface EmailJobData {
  type: 'otp' | 'password-reset' | 'notification';
  to: string;
  subject: string;
  text?: string;
  html?: string;
  otp?: string;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue('blockchain') private blockchainQueue: Queue<BlockchainJobData>,
    @InjectQueue('email') private emailQueue: Queue<EmailJobData>,
  ) {}

  // ─── Blockchain Queue ─────────────────────────────────────────────────────

  async addBlockchainJob(data: BlockchainJobData, priority: number = 0): Promise<string> {
    const job = await this.blockchainQueue.add(data.type, data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000, // 2s, 4s, 8s
      },
      priority, // Lower number = higher priority
      removeOnComplete: 100, // Keep last 100 successful jobs
      removeOnFail: 500,     // Keep last 500 failed jobs for debugging
    });

    this.logger.log(`Blockchain job queued: ${data.type} | Job ID: ${job.id}`);
    return job.id!;
  }

  async recordMatchOnChain(
    matchId: string,
    winnerId: string | null,
    loserId: string | null,
    onChainHash: string,
  ): Promise<string> {
    return this.addBlockchainJob({
      type: 'record-match',
      matchId,
      winnerId: winnerId ?? undefined,
      loserId: loserId ?? undefined,
      onChainHash,
    });
  }

  async mintBadgeOnChain(playerAddress: string, badgeName: string): Promise<string> {
    return this.addBlockchainJob({
      type: 'mint-badge',
      playerAddress,
      badgeName,
    }, 1); // Lower priority than match recording
  }

  // ─── Email Queue ──────────────────────────────────────────────────────────

  async addEmailJob(data: EmailJobData, priority: number = 0): Promise<string> {
    const job = await this.emailQueue.add(data.type, data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000, // 1s, 2s, 4s
      },
      priority,
      removeOnComplete: 50,
      removeOnFail: 200,
    });

    this.logger.log(`Email job queued: ${data.type} to ${data.to} | Job ID: ${job.id}`);
    return job.id!;
  }

  async sendOtpEmail(to: string, otp: string): Promise<string> {
    return this.addEmailJob({
      type: 'otp',
      to,
      subject: 'Your OTP for Web3 Battle Arena',
      otp,
    }, 0); // High priority for OTP
  }

  async sendPasswordResetEmail(to: string, otp: string): Promise<string> {
    return this.addEmailJob({
      type: 'password-reset',
      to,
      subject: 'Password Reset - Web3 Battle Arena',
      otp,
    }, 0); // High priority
  }

  async sendNotificationEmail(to: string, subject: string, html: string): Promise<string> {
    return this.addEmailJob({
      type: 'notification',
      to,
      subject,
      html,
    }, 2); // Lower priority for general notifications
  }

  // ─── Queue Status ─────────────────────────────────────────────────────────

  async getBlockchainQueueStatus() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.blockchainQueue.getWaitingCount(),
      this.blockchainQueue.getActiveCount(),
      this.blockchainQueue.getCompletedCount(),
      this.blockchainQueue.getFailedCount(),
    ]);

    return { queue: 'blockchain', waiting, active, completed, failed };
  }

  async getEmailQueueStatus() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.emailQueue.getWaitingCount(),
      this.emailQueue.getActiveCount(),
      this.emailQueue.getCompletedCount(),
      this.emailQueue.getFailedCount(),
    ]);

    return { queue: 'email', waiting, active, completed, failed };
  }

  async getAllQueueStatus() {
    return Promise.all([
      this.getBlockchainQueueStatus(),
      this.getEmailQueueStatus(),
    ]);
  }

  // ─── Queue Management ─────────────────────────────────────────────────────

  async retryFailedJobs(queueName: 'blockchain' | 'email'): Promise<number> {
    const queue = queueName === 'blockchain' ? this.blockchainQueue : this.emailQueue;
    const failed = await queue.getFailed();
    
    for (const job of failed) {
      await job.retry();
    }

    this.logger.log(`Retried ${failed.length} failed jobs in ${queueName} queue`);
    return failed.length;
  }

  async clearCompletedJobs(queueName: 'blockchain' | 'email'): Promise<void> {
    const queue = queueName === 'blockchain' ? this.blockchainQueue : this.emailQueue;
    await queue.clean(0, 1000, 'completed');
    this.logger.log(`Cleared completed jobs from ${queueName} queue`);
  }

  async clearFailedJobs(queueName: 'blockchain' | 'email'): Promise<void> {
    const queue = queueName === 'blockchain' ? this.blockchainQueue : this.emailQueue;
    await queue.clean(0, 1000, 'failed');
    this.logger.log(`Cleared failed jobs from ${queueName} queue`);
  }
}
