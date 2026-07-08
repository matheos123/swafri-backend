import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;
  private useBrevoApi = false;
  private brevoApiKey = '';

  constructor(private readonly config: ConfigService) {
    const mailHost = this.config.get<string>('mail.host');
    const mailPassword = this.config.get<string>('mail.password') || '';
    const envBrevoKey = process.env.BREVO_API_KEY || '';

    if (mailPassword.startsWith('xsmtpsib-') || envBrevoKey || mailHost?.includes('brevo')) {
      this.useBrevoApi = true;
      this.brevoApiKey = envBrevoKey || mailPassword;
      this.logger.log('EmailService: Using Brevo HTTP API for sending emails');
    } else {
      this.logger.log('EmailService: Using SMTP for sending emails');
      this.transporter = nodemailer.createTransport({
        host: mailHost,
        port: this.config.get<number>('mail.port'),
        secure: this.config.get<number>('mail.port') === 465, // true for 465, false for other ports
        auth: {
          user: this.config.get<string>('mail.user'),
          pass: mailPassword,
        },
      });
    }
  }

  private parseSenderInfo(): { name: string; email: string } {
    const fromHeader = this.config.get<string>('mail.from') || 'noreply@web3arena.com';
    let senderName = 'RPS Battle Arena';
    let senderEmail = 'noreply@web3arena.com';

    // Matches emails inside angle brackets like <info@domain.com>
    const emailMatch = fromHeader.match(/<([^>]+)>/);
    if (emailMatch) {
      senderEmail = emailMatch[1].trim();
      senderName = fromHeader.replace(emailMatch[0], '').replace(/"/g, '').trim() || senderName;
    } else {
      senderEmail = fromHeader.trim();
    }
    return { name: senderName, email: senderEmail };
  }

  async sendOtpEmail(to: string, otp: string): Promise<void> {
    const sender = this.parseSenderInfo();
    const subject = 'Password Reset OTP - RPS Battle Arena';
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 40px auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { color: #333; margin: 0; }
            .content { color: #666; line-height: 1.6; }
            .otp-box { background: #f8f9fa; border: 2px dashed #007bff; border-radius: 4px; padding: 20px; text-align: center; margin: 20px 0; }
            .otp-code { font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 5px; }
            .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 20px 0; color: #856404; }
            .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎮 RPS Battle Arena</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>You requested to reset your password. Use the following One-Time Password (OTP) to complete the process:</p>
              <div class="otp-box">
                <div class="otp-code">${otp}</div>
              </div>
              <p>This OTP is valid for <strong>10 minutes</strong>.</p>
              <div class="warning">
                <strong>⚠️ Security Notice:</strong> If you didn't request this password reset, please ignore this email and ensure your account is secure.
              </div>
              <p>Best regards,<br>Web3 Battle Arena Team</p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    if (this.useBrevoApi) {
      await this.sendViaBrevoApi(sender, to, subject, html);
    } else if (this.transporter) {
      const fromHeader = this.config.get<string>('mail.from');
      await this.transporter.sendMail({
        from: fromHeader,
        to,
        subject,
        html,
      });
    }
  }

  async sendPasswordChangedEmail(to: string): Promise<void> {
    const sender = this.parseSenderInfo();
    const subject = 'Password Changed Successfully - RPS Battle Arena';
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 40px auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { color: #333; margin: 0; }
            .content { color: #666; line-height: 1.6; }
            .success-box { background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; color: #155724; }
            .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 20px 0; color: #856404; }
            .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎮 RPS Battle Arena</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <div class="success-box">
                <strong>✓ Password Changed Successfully</strong>
              </div>
              <p>Your password has been changed successfully. You can now log in with your new password.</p>
              <div class="warning">
                <strong>⚠️ Security Notice:</strong> If you didn't make this change, please contact our support team immediately.
              </div>
              <p>Best regards,<br>Web3 Battle Arena Team</p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    if (this.useBrevoApi) {
      await this.sendViaBrevoApi(sender, to, subject, html);
    } else if (this.transporter) {
      const fromHeader = this.config.get<string>('mail.from');
      await this.transporter.sendMail({
        from: fromHeader,
        to,
        subject,
        html,
      });
    }
  }

  private async sendViaBrevoApi(
    sender: { name: string; email: string },
    to: string,
    subject: string,
    htmlContent: string,
  ): Promise<void> {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': this.brevoApiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender,
        to: [{ email: to }],
        subject,
        htmlContent,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Brevo API returned error: ${response.status} - ${errorText}`);
      throw new Error(`Failed to send email via Brevo API: ${errorText}`);
    }
  }
}
