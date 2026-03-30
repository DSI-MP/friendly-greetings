import { IsEmail, IsNotEmpty, IsBoolean, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

export class ChangePasswordDto {
  @IsNotEmpty()
  currentPassword: string;

  @IsNotEmpty()
  newPassword: string;

  @IsNotEmpty()
  confirmPassword: string;
}

export class RequestPasswordResetDto {
  @IsEmail()
  email: string;
}

export class RequestPasswordResetByEmpNoDto {
  @IsString()
  @IsNotEmpty()
  empNo: string;
}

export class VerifyOtpDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  otp: string;
}

export class ResetPasswordDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  otp: string;

  @IsNotEmpty()
  newPassword: string;

  @IsNotEmpty()
  confirmPassword: string;
}

export class RefreshTokenDto {
  @IsNotEmpty()
  refreshToken: string;
}

export class Verify2faDto {
  @IsNotEmpty()
  code: string;
}

export class Login2faDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  tempToken: string;

  @IsNotEmpty()
  code: string;
}
