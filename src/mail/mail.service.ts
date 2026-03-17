import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as hbs from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { OnEvent } from '@nestjs/event-emitter';

import { ConfigService } from '@nestjs/config';
import { OTPEmailContext, UserCreatedEvent } from 'src/common/types';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    const user = configService.get<string>('EMAIL_USERNAME');
    const pass = configService.get<string>('EMAIL_PASSWORD');

    if (!user || !pass) {
      throw new Error(
        `Mail transporter misconfigured: EMAIL_USERNAME=${user}, EMAIL_PASSWORD=${pass ? '***' : 'undefined'}`,
      );
    }

    this.transporter = nodemailer.createTransport({
      host: 'sandbox.smtp.mailtrap.io',
      port: 2525,
      auth: { user, pass },
    });
  }

  private compileTemplate<T>(templateName: string, context: T): string {
    const filePath = path.join(__dirname, 'templates', `${templateName}.hbs`);
    const templateSource = fs.readFileSync(filePath, 'utf8');
    const template = hbs.compile(templateSource);
    return template(context);
  }

  async sendEmail<T extends Record<string, unknown>>(
    to: string,
    subject: string,
    templateName: string,
    context: T,
  ): Promise<void> {
    if (!to || typeof to !== 'string' || to.trim() === '') {
      throw new Error('Recipient email is invalid');
    }

    const html = this.compileTemplate(templateName, context);
    const mailOptions: nodemailer.SendMailOptions = {
      from: this.configService.get('EMAIL_FROM'),
      to,
      subject,
      html,
    };

    await this.transporter.sendMail(mailOptions);
  }

  @OnEvent('user.created')
  async handleUserCreatedEvent(user: UserCreatedEvent): Promise<void> {
    console.log('Received user data:', user); // This is the payload
    await this.sendEmail<OTPEmailContext>(
      user.email,
      'Email Verification',
      'otp',
      { name: user.name, otpCode: user.otpCode, expiryMinutes: 5 },
    ); // Access the payload here

    console.log('Email sent successfully');
  }
}
