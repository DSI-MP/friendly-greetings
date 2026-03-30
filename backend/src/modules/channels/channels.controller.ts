import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ChannelsService } from './channels.service';
import { Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { AppRole } from '../../common/enums';

@ApiTags('Channels')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('channels')
export class ChannelsController {
  constructor(private channelsService: ChannelsService) {}

  @Get('status')
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN)
  getStatus() {
    return this.channelsService.getChannelStatus();
  }

  @Post('test-email')
  @Roles(AppRole.SUPER_ADMIN)
  async testEmail(@Body() body: { to: string; subject?: string }) {
    const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <div style="background:#b91c1c;padding:24px 32px;text-align:center;">
    <h1 style="margin:0;color:#fff;font-size:22px;">DSI Transport System</h1>
  </div>
  <div style="padding:32px;">
    <h2 style="color:#1f2937;">✅ Test Email Successful</h2>
    <p style="color:#4b5563;">This is a test email from DSI Transport System. If you received this, your Brevo email integration is working correctly.</p>
    <p style="color:#6b7280;font-size:13px;">Sent at: ${new Date().toISOString()}</p>
  </div>
  <div style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
    <p style="margin:0;color:#9ca3af;font-size:12px;">© ${new Date().getFullYear()} DSI Transport System</p>
  </div>
</div></body></html>`;

    const success = await this.channelsService.sendEmail(
      body.to,
      body.subject || 'DSI Transport – Test Email',
      html,
    );

    return { success, message: success ? 'Test email sent' : 'Failed to send test email' };
  }
}
