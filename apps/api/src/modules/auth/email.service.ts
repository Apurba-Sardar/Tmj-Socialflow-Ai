import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

import { loadEnvironment } from '@socialflow/config';
import { createLogger } from '@socialflow/logger';

@Injectable()
export class AuthEmailService {
  private readonly env = loadEnvironment();
  private readonly logger = createLogger('auth-email', this.env.LOG_LEVEL);
  private readonly transporter: Transporter | null;

  constructor() {
    this.transporter = this.env.SMTP_HOST
      ? createTransport({
          host: this.env.SMTP_HOST,
          port: this.env.SMTP_PORT,
          secure: this.env.SMTP_PORT === 465,
          auth:
            this.env.SMTP_USER && this.env.SMTP_PASSWORD
              ? { user: this.env.SMTP_USER, pass: this.env.SMTP_PASSWORD }
              : undefined,
        })
      : null;

    if (this.env.NODE_ENV === 'production' && !this.transporter) {
      throw new InternalServerErrorException('SMTP configuration is required in production.');
    }
  }

  async sendEmailVerification(email: string, token: string): Promise<void> {
    const url = `${this.env.APP_BASE_URL}/verify-email?token=${encodeURIComponent(token)}`;
    await this.send({
      to: email,
      subject: 'Verify your SocialFlow AI email',
      text: `Verify your email by opening this link: ${url}`,
      html: `<p>Verify your email by opening this secure link:</p><p><a href="${url}">Verify email</a></p>`,
    });
  }

  async sendPasswordReset(email: string, token: string): Promise<void> {
    const url = `${this.env.APP_BASE_URL}/reset-password?token=${encodeURIComponent(token)}`;
    await this.send({
      to: email,
      subject: 'Reset your SocialFlow AI password',
      text: `Reset your password by opening this link: ${url}`,
      html: `<p>Reset your password by opening this secure link:</p><p><a href="${url}">Reset password</a></p>`,
    });
  }

  private async send(message: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<void> {
    if (!this.transporter) {
      this.logger.info({ to: message.to, subject: message.subject, text: message.text }, 'Email queued');
      return;
    }

    await this.transporter.sendMail({
      from: this.env.SMTP_FROM,
      ...message,
    });
  }
}
