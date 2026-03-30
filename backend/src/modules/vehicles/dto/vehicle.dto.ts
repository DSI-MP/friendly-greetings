import { IsOptional, IsString, IsNumber, IsBoolean, IsNotEmpty, IsEnum } from 'class-validator';
import { VehicleType } from '../../../common/enums';

export class CreateVehicleDto {
  @IsNotEmpty() @IsString() registration_no: string;
  @IsNotEmpty() @IsEnum(VehicleType) type: VehicleType;
  @IsNotEmpty() @IsNumber() capacity: number;
  @IsOptional() @IsNumber() soft_overflow?: number;
  @IsOptional() @IsString() make?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() driver_name?: string;
  @IsOptional() @IsString() driver_phone?: string;
  @IsOptional() @IsString() driver_license_no?: string;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

export class UpdateVehicleDto {
  @IsOptional() @IsString() registration_no?: string;
  @IsOptional() @IsEnum(VehicleType) type?: VehicleType;
  @IsOptional() @IsNumber() capacity?: number;
  @IsOptional() @IsNumber() soft_overflow?: number;
  @IsOptional() @IsString() make?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() driver_name?: string;
  @IsOptional() @IsString() driver_phone?: string;
  @IsOptional() @IsString() driver_license_no?: string;
  @IsOptional() @IsBoolean() is_active?: boolean;
}
