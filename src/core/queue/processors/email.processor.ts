import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmailService } from '../../../modules/email/email.service';
import { EmailJobData } from '../queue.service';

@Processor('email')
export class EmailQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailQueueProcessor.name);

  constructor(private readonly emailService: EmailService) {
    super();
  }

  async process(job: Job<EmailJobData>): Promise<any> {
    this.logger.log(`Processing email job: ${job.name} | ID: ${job.id} | To: ${job.data.to}`);

    try {
      switch (job.data.type) {
        case 'otp':
          return await this.sendOtpEmail(job.data);
        
        case 'password-reset':
          return await this.sendPasswordResetEmail(job.data);
        
        case 'notification':
          return await this.sendNotificationEmail(job.data);
        
        default:
          throw new Error(`Unknown email job type: ${job.data.type}`);
      }
    } catch (error) {
      this.logger.error(
        `Email job failed: ${job.name} | ID: ${job.id} | Attempt: ${job.attemptsMade}/${job.opts.attempts}`,
        error,
      );
      throw error; // Re-throw to trigger BullMQ retry
    }
  }

  private async sendOtpEmail(data: EmailJobData): Promise<void> {
    if (!data.otp) {
      throw new Error('OTP is required for otp email job');
    }

    await this.emailService.sendOtpEmailDirect(data.to, data.otp);
    
    this.logger.log(`OTP email sent to ${data.to}`);
  }

  private async sendPasswordResetEmail(data: EmailJobData): Promise<void> {
    if (!data.otp) {
      throw new Error('OTP is required for password-reset email job');
    }

    await this.emailService.sendPasswordResetEmailDirect(data.to, data.otp);
    
    this.logger.log(`Password reset email sent to ${data.to}`);
  }

  private async sendNotificationEmail(data: EmailJobData): Promise<void> {
    if (!data.html && !data.text) {
      throw new Error('Email content (html or text) is required');
    }

    await this.emailService.sendEmailDirect({
      to: data.to,
      subject: data.subject,
      text: data.text,
      html: data.html,
    });
    
    this.logger.log(`Notification email sent to ${data.to}: ${data.subject}`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<EmailJobData>, result: any) {
    this.logger.log(
      `✅ Email job completed: ${job.name} | ID: ${job.id} | To: ${job.data.to}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<EmailJobData> | undefined, error: Error) {
    if (job) {
      this.logger.error(
        `❌ Email job failed permanently: ${job.name} | ID: ${job.id} | To: ${job.data.to} | Attempts: ${job.attemptsMade}`,
        error.stack,
      );
    } else {
      this.logger.error('❌ Email job failed with unknown job', error.stack);
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job<EmailJobData>) {
    this.logger.log(
      `🔄 Email job started: ${job.name} | ID: ${job.id} | To: ${job.data.to} | Attempt: ${job.attemptsMade + 1}/${job.opts.attempts}`,
    );
  }
}
