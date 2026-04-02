import { IsNotEmpty, IsEmail, IsOptional, IsEnum, IsNumber, MinLength, Matches } from 'class-validator';
import { SelfRegRole } from '../../../common/enums';

/** Shared strong password regex: min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special char */
export const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
export const STRONG_PASSWORD_MSG = 'Password must be at least 8 characters with uppercase, lowercase, number, and special character';

export class SelfRegisterDto {
  @IsNotEmpty()
  fullName: string;

  @IsEmail()
  email: string;

  @IsNotEmpty()
  phone: string;

  @IsNumber()
  departmentId: number;

  @IsEnum(SelfRegRole)
  registerAs: SelfRegRole;

  @IsNotEmpty()
  empNo: string;

  @IsOptional()
  placeId?: number;

  @IsNotEmpty()
  @MinLength(8)
  @Matches(STRONG_PASSWORD_REGEX, { message: STRONG_PASSWORD_MSG })
  password: string;

  @IsNotEmpty()
  confirmPassword: string;
}

export class CreateEmployeeDto {
  @IsNotEmpty()
  fullName: string;

  @IsEmail()
  email: string;

  @IsOptional()
  phone?: string;

  @IsOptional()
  empNo?: string;

  @IsNumber()
  departmentId: number;

  @IsOptional()
  placeId?: number;

  @IsOptional()
  lat?: number;

  @IsOptional()
  lng?: number;

  @IsNotEmpty()
  @MinLength(8)
  @Matches(STRONG_PASSWORD_REGEX, { message: STRONG_PASSWORD_MSG })
  password: string;

  @IsNotEmpty()
  confirmPassword: string;
}

export class LocationChangeRequestDto {
  @IsOptional()
  placeId?: number;

  @IsOptional()
  lat?: number;

  @IsOptional()
  lng?: number;

  @IsOptional()
  reason?: string;
}
