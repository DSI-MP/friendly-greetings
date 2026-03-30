import { Controller, Post, Get, Body, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  LoginDto, ChangePasswordDto, RequestPasswordResetDto,
  RequestPasswordResetByEmpNoDto, VerifyOtpDto, ResetPasswordDto, RefreshTokenDto,
  Verify2faDto, Login2faDto,
} from './dto/auth.dto';
import { CurrentUser } from '../../common/decorators';
import { Request } from 'express';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req.ip, req.headers['user-agent']);
  }

  @Post('verify-2fa-login')
  @HttpCode(HttpStatus.OK)
  async verify2faLogin(@Body() dto: Login2faDto) {
    return this.authService.verify2faLogin(dto);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  async me(@CurrentUser() user: any) {
    return this.authService.getMe(user.id);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser('id') userId: number) {
    return this.authService.logout(userId);
  }

  @Post('change-password')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async changePassword(@CurrentUser('id') userId: number, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(userId, dto);
  }

  /* ─── 2FA Endpoints ─── */
  @Post('2fa/setup')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async setup2fa(@CurrentUser('id') userId: number) {
    return this.authService.setup2fa(userId);
  }

  @Post('2fa/verify-setup')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async verify2faSetup(@CurrentUser('id') userId: number, @Body() dto: Verify2faDto) {
    return this.authService.verify2faSetup(userId, dto);
  }

  @Post('2fa/disable')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  async disable2fa(@CurrentUser('id') userId: number, @Body() dto: Verify2faDto) {
    return this.authService.disable2fa(userId, dto);
  }

  @Post('request-password-reset')
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Post('request-password-reset-by-empno')
  @HttpCode(HttpStatus.OK)
  async requestPasswordResetByEmpNo(@Body() dto: RequestPasswordResetByEmpNoDto) {
    return this.authService.requestPasswordResetByEmpNo(dto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
