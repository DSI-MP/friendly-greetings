import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationDeliveryLog } from '../notifications/notification.entity';
import { NotificationChannel } from '../../common/enums';

/* ────────────────────────── Email purpose keys ────────────────────────── */

export type EmailPurpose = 'password_reset' | 'notification' | 'transport';

/* ────────────────────────── Email Templates ────────────────────────── */

const DSI_HEADER = `
<div style="background:#b91c1c;padding:24px 32px;text-align:center;">
  <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">DSI Transport System</h1>
</div>`;

const DSI_FOOTER = `
<div style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
  <p style="margin:0;color:#9ca3af;font-size:12px;">© ${new Date().getFullYear()} DSI Transport System. All rights reserved.</p>
  <p style="margin:4px 0 0;color:#9ca3af;font-size:11px;">This is an automated message. Please do not reply.</p>
</div>`;

function wrapEmail(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
<div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  ${DSI_HEADER}
  <div style="padding:32px;">
    ${bodyHtml}
  </div>
  ${DSI_FOOTER}
</div>
</body>
</html>`;
}

/* ──────────────────── Email Template builders ──────────────────── */

export function passwordResetEmailHtml(recipientName: string, otp: string, expiryMinutes = 5): string {
  return wrapEmail('Password Reset – DSI Transport', `
    <h2 style="margin:0 0 8px;color:#1f2937;font-size:20px;">Password Reset Request</h2>
    <p style="color:#4b5563;font-size:15px;line-height:1.6;">Hello <strong>${recipientName}</strong>,</p>
    <p style="color:#4b5563;font-size:15px;line-height:1.6;">We received a request to reset your password. Use the OTP code below to proceed:</p>
    <div style="text-align:center;margin:28px 0;">
      <div style="display:inline-block;background:#fef2f2;border:2px solid #b91c1c;border-radius:10px;padding:16px 40px;">
        <span style="font-size:32px;font-weight:800;letter-spacing:8px;color:#b91c1c;">${otp}</span>
      </div>
    </div>
    <p style="color:#6b7280;font-size:13px;text-align:center;">This code expires in <strong>${expiryMinutes} minutes</strong>.</p>
    <div style="background:#fef2f2;border-left:4px solid #b91c1c;padding:12px 16px;margin:20px 0;border-radius:0 8px 8px 0;">
      <p style="margin:0;color:#991b1b;font-size:13px;">⚠️ If you did not request this, please ignore this email or contact your administrator.</p>
    </div>
  `);
}

export function notificationEmailHtml(recipientName: string, title: string, message: string): string {
  return wrapEmail('Notification – DSI Transport', `
    <h2 style="margin:0 0 8px;color:#1f2937;font-size:20px;">📢 ${title}</h2>
    <p style="color:#4b5563;font-size:15px;line-height:1.6;">Hello <strong>${recipientName}</strong>,</p>
    <p style="color:#4b5563;font-size:15px;line-height:1.6;">${message}</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="#" style="display:inline-block;background:#b91c1c;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;">View in Dashboard</a>
    </div>
  `);
}

export function transportDetailsEmailHtml(
  recipientName: string,
  date: string,
  details: { route: string; vehicle: string; driver: string; pickupTime: string; pickupPoint: string },
): string {
  return wrapEmail('Today\'s Transport Details – DSI Transport', `
    <h2 style="margin:0 0 8px;color:#1f2937;font-size:20px;">🚐 Your Transport Details</h2>
    <p style="color:#4b5563;font-size:15px;line-height:1.6;">Hello <strong>${recipientName}</strong>,</p>
    <p style="color:#4b5563;font-size:15px;line-height:1.6;">Here are your transport arrangements for <strong>${date}</strong>:</p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:12px 16px;color:#6b7280;font-size:14px;font-weight:600;width:140px;">🛣️ Route</td>
        <td style="padding:12px 16px;color:#1f2937;font-size:14px;">${details.route}</td>
      </tr>
      <tr style="border-bottom:1px solid #e5e7eb;background:#f9fafb;">
        <td style="padding:12px 16px;color:#6b7280;font-size:14px;font-weight:600;">🚌 Vehicle</td>
        <td style="padding:12px 16px;color:#1f2937;font-size:14px;">${details.vehicle}</td>
      </tr>
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:12px 16px;color:#6b7280;font-size:14px;font-weight:600;">👤 Driver</td>
        <td style="padding:12px 16px;color:#1f2937;font-size:14px;">${details.driver}</td>
      </tr>
      <tr style="border-bottom:1px solid #e5e7eb;background:#f9fafb;">
        <td style="padding:12px 16px;color:#6b7280;font-size:14px;font-weight:600;">⏰ Pickup Time</td>
        <td style="padding:12px 16px;color:#1f2937;font-size:14px;font-weight:700;">${details.pickupTime}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;color:#6b7280;font-size:14px;font-weight:600;">📍 Pickup Point</td>
        <td style="padding:12px 16px;color:#1f2937;font-size:14px;">${details.pickupPoint}</td>
      </tr>
    </table>
    <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;margin:20px 0;border-radius:0 8px 8px 0;">
      <p style="margin:0;color:#166534;font-size:13px;">✅ Please be at your pickup point at least 5 minutes before the scheduled time.</p>
    </div>
  `);
}

/* ──────────────── SMS Templates ──────────────── */

export function passwordResetSms(otp: string, expiryMinutes = 5): string {
  return `[DSI Transport] Your password reset code is: ${otp}. Valid for ${expiryMinutes} minutes. Do not share this code.`;
}

export function notificationSms(title: string, message: string): string {
  const truncated = message.length > 100 ? message.substring(0, 97) + '...' : message;
  return `[DSI Transport] ${title}: ${truncated}`;
}

export function transportDetailsSms(
  date: string,
  details: { route: string; vehicle: string; pickupTime: string; pickupPoint: string },
): string {
  return `[DSI Transport] ${date} - Route: ${details.route}, Vehicle: ${details.vehicle}, Pickup: ${details.pickupTime} at ${details.pickupPoint}. Be ready 5 min early.`;
}

/* ──────────────── WhatsApp Templates ──────────────── */

export function passwordResetWhatsApp(recipientName: string, otp: string, expiryMinutes = 5): string {
  return `🔐 *DSI Transport System*\n\nHello ${recipientName},\n\nYour password reset OTP is: *${otp}*\n⏳ Valid for ${expiryMinutes} minutes.\n\n⚠️ Do not share this code with anyone.`;
}

export function notificationWhatsApp(recipientName: string, title: string, message: string): string {
  return `📢 *DSI Transport System*\n\nHello ${recipientName},\n\n*${title}*\n${message}\n\n🔗 Check your dashboard for more details.`;
}

export function transportDetailsWhatsApp(
  recipientName: string,
  date: string,
  details: { route: string; vehicle: string; driver: string; pickupTime: string; pickupPoint: string },
): string {
  return `🚐 *DSI Transport System*\n\nHello ${recipientName},\n\n*Your Transport Details for ${date}:*\n\n🛣️ Route: ${details.route}\n🚌 Vehicle: ${details.vehicle}\n👤 Driver: ${details.driver}\n⏰ Pickup: *${details.pickupTime}*\n📍 Point: ${details.pickupPoint}\n\n✅ Please be at your pickup point 5 minutes early.`;
}

/* ──────────────────── Channel Service ──────────────────── */

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(
    private config: ConfigService,
    @InjectRepository(NotificationDeliveryLog) private logRepo: Repository<NotificationDeliveryLog>,
  ) {}

  /** Get the correct Brevo API key based on email purpose */
  private getBrevoApiKey(purpose: EmailPurpose): string | undefined {
    const keyMap: Record<EmailPurpose, string> = {
      password_reset: 'channels.brevoPasswordResetApiKey',
      notification: 'channels.brevoNotificationApiKey',
      transport: 'channels.brevoTransportApiKey',
    };
    return this.config.get<string>(keyMap[purpose]) || undefined;
  }

  /* ─── Brevo Email (with purpose-based API key) ─── */
  async sendEmail(to: string, subject: string, htmlContent: string, purpose: EmailPurpose = 'notification', notificationId?: number): Promise<boolean> {
    const apiKey = this.getBrevoApiKey(purpose);
    const senderEmail = this.config.get<string>('channels.brevoSenderEmail');
    const senderName = this.config.get<string>('channels.brevoSenderName');

    if (!apiKey) {
      this.logger.warn(`Brevo API key not configured for "${purpose}" – email not sent`);
      return false;
    }

    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: to }],
          subject,
          htmlContent,
        }),
      });

      const data = await res.json();
      const success = res.ok;

      this.logger.log(
        `[Brevo][${purpose}] status=${res.status} ok=${res.ok} to=${to} sender=${senderEmail} keySuffix=${apiKey.slice(-6)} response=${JSON.stringify(data)}`
      );

      if (notificationId) {
        await this.logDelivery(notificationId, NotificationChannel.EMAIL, success, success ? undefined : JSON.stringify(data), data);
      }

      if (!success) {
        this.logger.error(`Brevo email failed [${purpose}]: ${JSON.stringify(data)}`);
      } else {
        this.logger.log(`Email sent [${purpose}] to ${to}: ${subject}`);
      }

      return success;
    } catch (err) {
      this.logger.error(`Brevo email error [${purpose}]: ${err.message}`);
      if (notificationId) {
        await this.logDelivery(notificationId, NotificationChannel.EMAIL, false, err.message);
      }
      return false;
    }
  }

  /* ─── SMS (disabled by default) ─── */
  async sendSms(phone: string, message: string, notificationId?: number): Promise<boolean> {
    const enabled = this.config.get<boolean>('channels.smsEnabled');
    if (!enabled) {
      this.logger.debug('SMS channel disabled – message not sent');
      return false;
    }

    const apiKey = this.config.get<string>('channels.smsApiKey');
    const smsProvider = this.config.get<string>('channels.smsProvider');

    if (!apiKey) {
      this.logger.warn('SMS API key not configured');
      return false;
    }

    try {
      this.logger.log(`[SMS-${smsProvider}] Would send to ${phone}: ${message}`);
      if (notificationId) {
        await this.logDelivery(notificationId, NotificationChannel.SMS, false, 'SMS provider not yet integrated');
      }
      return false;
    } catch (err) {
      this.logger.error(`SMS error: ${err.message}`);
      if (notificationId) {
        await this.logDelivery(notificationId, NotificationChannel.SMS, false, err.message);
      }
      return false;
    }
  }

  /* ─── WhatsApp (disabled by default) ─── */
  async sendWhatsApp(phone: string, message: string, notificationId?: number): Promise<boolean> {
    const enabled = this.config.get<boolean>('channels.whatsappEnabled');
    if (!enabled) {
      this.logger.debug('WhatsApp channel disabled – message not sent');
      return false;
    }

    const apiKey = this.config.get<string>('channels.whatsappApiKey');

    if (!apiKey) {
      this.logger.warn('WhatsApp API key not configured');
      return false;
    }

    try {
      this.logger.log(`[WhatsApp] Would send to ${phone}: ${message.substring(0, 50)}...`);
      if (notificationId) {
        await this.logDelivery(notificationId, NotificationChannel.WHATSAPP, false, 'WhatsApp provider not yet integrated');
      }
      return false;
    } catch (err) {
      this.logger.error(`WhatsApp error: ${err.message}`);
      if (notificationId) {
        await this.logDelivery(notificationId, NotificationChannel.WHATSAPP, false, err.message);
      }
      return false;
    }
  }

  /* ─── Channel Status (shows all 3 email keys + SMS + WhatsApp) ─── */
  getChannelStatus() {
    const prKey = this.config.get<string>('channels.brevoPasswordResetApiKey');
    const notifKey = this.config.get<string>('channels.brevoNotificationApiKey');
    const transKey = this.config.get<string>('channels.brevoTransportApiKey');

    return {
      emailPasswordReset: {
        enabled: !!prKey,
        provider: 'Brevo',
        configured: !!prKey,
        label: 'Password Reset Email',
      },
      emailNotification: {
        enabled: !!notifKey,
        provider: 'Brevo',
        configured: !!notifKey,
        label: 'Notification Email',
      },
      emailTransport: {
        enabled: !!transKey,
        provider: 'Brevo',
        configured: !!transKey,
        label: 'Transport Details Email',
      },
      sms: {
        enabled: this.config.get<boolean>('channels.smsEnabled') || false,
        provider: this.config.get<string>('channels.smsProvider') || 'Not configured',
        configured: !!this.config.get<string>('channels.smsApiKey'),
        label: 'SMS',
      },
      whatsapp: {
        enabled: this.config.get<boolean>('channels.whatsappEnabled') || false,
        provider: 'WhatsApp Business API',
        configured: !!this.config.get<string>('channels.whatsappApiKey'),
        label: 'WhatsApp',
      },
    };
  }

  private async logDelivery(
    notificationId: number,
    channel: NotificationChannel,
    delivered: boolean,
    errorMessage?: string,
    providerResponse?: Record<string, any>,
  ) {
    await this.logRepo.save(this.logRepo.create({
      notification_id: notificationId,
      channel,
      delivered,
      error_message: errorMessage,
      provider_response: providerResponse,
    }));
  }
}
