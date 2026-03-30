import { IsNotEmpty, IsEmail, IsOptional, IsEnum, IsNumber, MinLength } from 'class-validator';
import { SelfRegRole } from '../../../common/enums';

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
  @MinLength(6)
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
  @MinLength(6)
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
