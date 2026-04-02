import { Injectable, UnauthorizedException, BadRequestException, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, MoreThanOrEqual } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { authenticator } from 'otplib';
import { User } from '../users/user.entity';
import { Employee } from '../employees/employee.entity';
import { AuthEvent, PasswordResetRequest } from '../audit/audit.entity';
import { AccountStatus } from '../../common/enums';
import {
  LoginDto, ChangePasswordDto, RequestPasswordResetDto,
  RequestPasswordResetByEmpNoDto, VerifyOtpDto, ResetPasswordDto, RefreshTokenDto,
  Verify2faDto, Login2faDto,
} from './dto/auth.dto';
import { ChannelsService, passwordResetEmailHtml, passwordResetSms, passwordResetWhatsApp } from '../channels/channels.service';

/** Mask email: sandaruwan@gmail.com → sanda*****n@gmail.com */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (local.length <= 3) return `${local[0]}***@${domain}`;
  const start = local.substring(0, 4);
  const end = local.substring(local.length - 1);
  return `${start}*****${end}@${domain}`;
}

/** Get today's start in Sri Lanka timezone (GMT+5:30) */
function getSriLankaDayStart(): Date {
  const now = new Date();
  const sriLankaOffset = 5.5 * 60 * 60 * 1000;
  const sriLankaNow = new Date(now.getTime() + sriLankaOffset);
  const slDayStart = new Date(Date.UTC(
    sriLankaNow.getUTCFullYear(),
    sriLankaNow.getUTCMonth(),
    sriLankaNow.getUTCDate(),
    0, 0, 0, 0,
  ));
  return new Date(slDayStart.getTime() - sriLankaOffset);
}

/** Generic response for password reset to prevent enumeration */
const GENERIC_RESET_RESPONSE = 'If an account exists with the provided details, a verification code has been sent.';

/** Max OTP verification attempts before lockout */
const MAX_OTP_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Employee) private employeeRepo: Repository<Employee>,
    @InjectRepository(AuthEvent) private authEventRepo: Repository<AuthEvent>,
    @InjectRepository(PasswordResetRequest) private resetRepo: Repository<PasswordResetRequest>,
    private jwtService: JwtService,
    private config: ConfigService,
    private channelsService: ChannelsService,
  ) {}

  async getMe(userId: number) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    return {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      departmentId: user.department_id,
      employeeId: user.employee_id,
      phone: user.phone,
      f2a_enabled: user.f2a_enabled,
    };
  }

  async login(dto: LoginDto, ip?: string, userAgent?: string) {
    const user = await this.userRepo.findOne({ where: { email: dto.email.toLowerCase().trim() } });

    if (!user) {
      await this.logAuthEvent(null, dto.email, 'LOGIN', false, 'User not found', ip, userAgent);
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status === AccountStatus.SUSPENDED) {
      await this.logAuthEvent(user.id, dto.email, 'LOGIN', false, 'Account suspended', ip, userAgent);
      throw new UnauthorizedException('Your account has been suspended. Contact admin.');
    }

    if (user.status === AccountStatus.PENDING_APPROVAL) {
      await this.logAuthEvent(user.id, dto.email, 'LOGIN', false, 'Pending approval', ip, userAgent);
      throw new UnauthorizedException('Your account is pending approval.');
    }

    if (user.status === AccountStatus.INACTIVE) {
      await this.logAuthEvent(user.id, dto.email, 'LOGIN', false, 'Inactive account', ip, userAgent);
      throw new UnauthorizedException('Your account is inactive. Contact admin.');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password_hash);
    if (!passwordValid) {
      await this.logAuthEvent(user.id, dto.email, 'LOGIN', false, 'Wrong password', ip, userAgent);
      throw new UnauthorizedException('Invalid email or password');
    }

    // If 2FA is enabled, return a temp token instead of full login
    if (user.f2a_enabled && user.f2a_secret) {
      const tempToken = this.jwtService.sign(
        { sub: user.id, email: user.email, purpose: '2fa' },
        { expiresIn: '5m' },
      );
      await this.logAuthEvent(user.id, dto.email, 'LOGIN', true, '2FA required', ip, userAgent);
      return { requires2fa: true, tempToken, email: user.email };
    }

    const tokens = await this.generateTokens(user, dto.rememberMe);

    const refreshHash = await bcrypt.hash(tokens.refreshToken, 10);
    await this.userRepo.update(user.id, { refresh_token_hash: refreshHash, last_login_at: new Date() });

    await this.logAuthEvent(user.id, dto.email, 'LOGIN', true, undefined, ip, userAgent);

    return {
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        departmentId: user.department_id,
        employeeId: user.employee_id,
        phone: user.phone,
        f2a_enabled: user.f2a_enabled,
      },
    };
  }

  async verify2faLogin(dto: Login2faDto) {
    let payload: any;
    try {
      payload = this.jwtService.verify(dto.tempToken, { secret: this.config.get<string>('jwt.secret') });
    } catch {
      throw new UnauthorizedException('2FA session expired. Please login again.');
    }
    if (payload.purpose !== '2fa') throw new UnauthorizedException('Invalid 2FA token');

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user || !user.f2a_secret) throw new UnauthorizedException('User not found');

    const isValid = authenticator.verify({ token: dto.code, secret: user.f2a_secret });
    if (!isValid) throw new UnauthorizedException('Invalid 2FA code');

    const tokens = await this.generateTokens(user);
    const refreshHash = await bcrypt.hash(tokens.refreshToken, 10);
    await this.userRepo.update(user.id, { refresh_token_hash: refreshHash, last_login_at: new Date() });

    return {
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        departmentId: user.department_id,
        employeeId: user.employee_id,
        phone: user.phone,
        f2a_enabled: user.f2a_enabled,
      },
    };
  }

  /* ─── 2FA Setup & Management ─── */
  async setup2fa(userId: number) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    if (user.f2a_enabled) throw new BadRequestException('2FA is already enabled');

    const secret = authenticator.generateSecret();
    const appName = this.config.get<string>('appName', 'DSI Transport');
    const otpauthUrl = authenticator.keyuri(user.email, appName, secret);

    // Store secret temporarily (not enabled yet until verified)
    await this.userRepo.update(userId, { f2a_secret: secret });

    return { secret, otpauthUrl };
  }

  async verify2faSetup(userId: number, dto: Verify2faDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.f2a_secret) throw new BadRequestException('Setup 2FA first');

    const isValid = authenticator.verify({ token: dto.code, secret: user.f2a_secret });
    if (!isValid) throw new BadRequestException('Invalid verification code. Please try again.');

    await this.userRepo.update(userId, { f2a_enabled: true });
    return { message: '2FA enabled successfully' };
  }

  async disable2fa(userId: number, dto: Verify2faDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.f2a_enabled || !user.f2a_secret) throw new BadRequestException('2FA is not enabled');

    const isValid = authenticator.verify({ token: dto.code, secret: user.f2a_secret });
    if (!isValid) throw new BadRequestException('Invalid verification code');

    await this.userRepo.update(userId, { f2a_enabled: false, f2a_secret: null });
    return { message: '2FA disabled successfully' };
  }

  async refresh(dto: RefreshTokenDto) {
    try {
      const payload = this.jwtService.verify(dto.refreshToken, {
        secret: this.config.get<string>('jwt.secret'),
      });

      const user = await this.userRepo.findOne({ where: { id: payload.sub } });
      if (!user || !user.refresh_token_hash) throw new UnauthorizedException('Invalid refresh token');

      const valid = await bcrypt.compare(dto.refreshToken, user.refresh_token_hash);
      if (!valid) throw new UnauthorizedException('Invalid refresh token');

      const tokens = await this.generateTokens(user);
      const refreshHash = await bcrypt.hash(tokens.refreshToken, 10);
      await this.userRepo.update(user.id, { refresh_token_hash: refreshHash });

      return { token: tokens.accessToken, refreshToken: tokens.refreshToken };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(userId: number) {
    await this.userRepo.update(userId, { refresh_token_hash: undefined });
    return { message: 'Logged out' };
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const valid = await bcrypt.compare(dto.currentPassword, user.password_hash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const hash = await bcrypt.hash(dto.newPassword, 12);
    // Invalidate refresh token to force re-login on other devices
    await this.userRepo.update(userId, { password_hash: hash, refresh_token_hash: null as any });

    this.logger.log(`[ChangePassword] User ${userId} changed password, sessions invalidated`);
    return { message: 'Password changed successfully. Please log in again on other devices.' };
  }

  /* ─── Rate limit check: 2 requests per day (resets at 00:00 GMT+5:30) ─── */
  private async checkDailyRateLimit(userId: number): Promise<void> {
    const dayStart = getSriLankaDayStart();
    const todayCount = await this.resetRepo.count({
      where: {
        user_id: userId,
        created_at: MoreThanOrEqual(dayStart),
      },
    });
    if (todayCount >= 2) {
      throw new HttpException('You can only request a password reset 2 times per day. Please try again tomorrow.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  /* ─── Core OTP send logic (shared between email & emp_no reset) ─── */
  private async sendPasswordResetOtp(user: User): Promise<void> {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Hash OTP before storing
    const otpHash = await bcrypt.hash(otp, 10);

    // Invalidate previous requests
    await this.resetRepo.update(
      { user_id: user.id, used: false },
      { used: true },
    );

    await this.resetRepo.save({
      user_id: user.id,
      email: user.email,
      otp: otpHash,
      otp_attempts: 0,
      expires_at: expiresAt,
    });

    // Send OTP via configured channels
    const emailHtml = passwordResetEmailHtml(user.full_name, otp, 5);
    let emailSent = false;
    try {
      emailSent = await this.channelsService.sendEmail(user.email, 'Password Reset – DSI Transport System', emailHtml, 'password_reset');
    } catch (err) {
      this.logger.error(`Password reset email error for ${maskEmail(user.email)}: ${err.message}`);
    }

    // Try SMS/WhatsApp as fallback channels
    let smsSent = false;
    let whatsappSent = false;
    if (user.phone) {
      try {
        smsSent = await this.channelsService.sendSms(user.phone, passwordResetSms(otp, 5));
      } catch (err) {
        this.logger.error(`Password reset SMS error: ${err.message}`);
      }
      try {
        whatsappSent = await this.channelsService.sendWhatsApp(user.phone, passwordResetWhatsApp(user.full_name, otp, 5));
      } catch (err) {
        this.logger.error(`Password reset WhatsApp error: ${err.message}`);
      }
    }

    this.logger.log(`[PasswordReset] OTP sent for ${maskEmail(user.email)} | emailSent=${emailSent} smsSent=${smsSent} whatsappSent=${whatsappSent}`);

    if (!emailSent && !smsSent && !whatsappSent) {
      this.logger.error(`Password reset: ALL channels failed for ${maskEmail(user.email)}.`);
      throw new HttpException(
        'Unable to send verification code. Please contact your administrator or try again later.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /* ─── Reset by Email (generic response to prevent enumeration) ─── */
  async requestPasswordReset(dto: RequestPasswordResetDto) {
    const user = await this.userRepo.findOne({ where: { email: dto.email.toLowerCase().trim() } });

    if (!user) {
      // Return generic response — do not reveal whether email exists
      this.logger.log(`[PasswordReset] Request for non-existent email (not revealed to client)`);
      return { message: GENERIC_RESET_RESPONSE };
    }

    try {
      await this.checkDailyRateLimit(user.id);
      await this.sendPasswordResetOtp(user);
    } catch (err) {
      // If rate limited or channel failure, still return generic for enumeration safety
      // unless it's a rate limit (which is safe to reveal since user already knows their account)
      if (err instanceof HttpException && err.getStatus() === HttpStatus.TOO_MANY_REQUESTS) {
        throw err;
      }
      if (err instanceof HttpException && err.getStatus() === HttpStatus.SERVICE_UNAVAILABLE) {
        throw err;
      }
      this.logger.error(`[PasswordReset] Error: ${err.message}`);
    }

    return { message: GENERIC_RESET_RESPONSE };
  }

  /* ─── Reset by Employee Number (generic response) ─── */
  async requestPasswordResetByEmpNo(dto: RequestPasswordResetByEmpNoDto) {
    const empNo = dto.empNo.trim();

    const employee = await this.employeeRepo.findOne({ where: { emp_no: empNo } });
    if (!employee || !employee.user_id) {
      this.logger.log(`[PasswordReset] Request for non-existent emp_no or unlinked (not revealed to client)`);
      return { message: GENERIC_RESET_RESPONSE };
    }

    const user = await this.userRepo.findOne({ where: { id: employee.user_id } });
    if (!user) {
      return { message: GENERIC_RESET_RESPONSE };
    }

    try {
      await this.checkDailyRateLimit(user.id);
      await this.sendPasswordResetOtp(user);
    } catch (err) {
      if (err instanceof HttpException && err.getStatus() === HttpStatus.TOO_MANY_REQUESTS) {
        throw err;
      }
      if (err instanceof HttpException && err.getStatus() === HttpStatus.SERVICE_UNAVAILABLE) {
        throw err;
      }
      this.logger.error(`[PasswordReset] Error: ${err.message}`);
    }

    return { message: GENERIC_RESET_RESPONSE };
  }

  /* ─── Verify OTP (with brute-force protection) ─── */
  async verifyOtp(dto: VerifyOtpDto) {
    const email = dto.email.toLowerCase().trim();

    // Find the latest unused reset request for this email
    const resetReq = await this.resetRepo.findOne({
      where: {
        email,
        used: false,
        expires_at: MoreThan(new Date()),
      },
      order: { created_at: 'DESC' },
    });

    if (!resetReq) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    // Check attempt limit
    if ((resetReq as any).otp_attempts >= MAX_OTP_ATTEMPTS) {
      await this.resetRepo.update(resetReq.id, { used: true });
      throw new BadRequestException('Too many invalid attempts. Please request a new verification code.');
    }

    // Compare hashed OTP
    const otpValid = await bcrypt.compare(dto.otp, resetReq.otp);
    if (!otpValid) {
      // Increment attempt counter
      await this.resetRepo.increment({ id: resetReq.id }, 'otp_attempts', 1);
      throw new BadRequestException('Invalid or expired verification code');
    }

    return { message: 'OTP verified', valid: true };
  }

  /* ─── Reset Password (with session invalidation) ─── */
  async resetPassword(dto: ResetPasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const email = dto.email.toLowerCase().trim();

    const resetReq = await this.resetRepo.findOne({
      where: {
        email,
        used: false,
        expires_at: MoreThan(new Date()),
      },
      order: { created_at: 'DESC' },
    });

    if (!resetReq) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    // Check attempt limit
    if ((resetReq as any).otp_attempts >= MAX_OTP_ATTEMPTS) {
      await this.resetRepo.update(resetReq.id, { used: true });
      throw new BadRequestException('Too many invalid attempts. Please request a new verification code.');
    }

    // Compare hashed OTP
    const otpValid = await bcrypt.compare(dto.otp, resetReq.otp);
    if (!otpValid) {
      await this.resetRepo.increment({ id: resetReq.id }, 'otp_attempts', 1);
      throw new BadRequestException('Invalid or expired verification code');
    }

    const user = await this.userRepo.findOne({ where: { id: resetReq.user_id } });
    if (!user) throw new BadRequestException('User not found');

    const hash = await bcrypt.hash(dto.newPassword, 12);
    // Invalidate all sessions by clearing refresh token hash
    await this.userRepo.update(user.id, { password_hash: hash, refresh_token_hash: null as any });
    await this.resetRepo.update(resetReq.id, { used: true });

    // Invalidate all other unused reset requests for this user
    await this.resetRepo.update(
      { user_id: user.id, used: false },
      { used: true },
    );

    this.logger.log(`[PasswordReset] Password reset completed for user ${user.id}, sessions invalidated`);
    return { message: 'Password reset successfully' };
  }

  private async generateTokens(user: User, rememberMe = false) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      departmentId: user.department_id,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.config.get<string>('jwt.expiresIn', '15m'),
    });

    const refreshExpiresIn = rememberMe ? '30d' : this.config.get<string>('jwt.refreshExpiresIn', '7d');
    const refreshToken = this.jwtService.sign(payload, { expiresIn: refreshExpiresIn });

    return { accessToken, refreshToken };
  }

  private async logAuthEvent(
    userId: number | null,
    email: string,
    eventType: string,
    success: boolean,
    failureReason?: string,
    ip?: string,
    userAgent?: string,
  ) {
    const authEvent = this.authEventRepo.create({
      user_id: userId ?? undefined,
      email,
      event_type: eventType,
      success,
      failure_reason: failureReason,
      ip_address: ip,
      user_agent: userAgent,
    });

    await this.authEventRepo.save(authEvent);
  }
}
