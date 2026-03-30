import { IsOptional, IsString, IsNumber, IsBoolean, IsNotEmpty } from 'class-validator';

export class CreateDriverDto {
  @IsNotEmpty() @IsString() full_name: string;
  @IsNotEmpty() @IsString() phone: string;
  @IsOptional() @IsString() license_no?: string;
  @IsOptional() @IsNumber() default_vehicle_id?: number;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

export class UpdateDriverDto {
  @IsOptional() @IsString() full_name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() license_no?: string;
  @IsOptional() @IsNumber() default_vehicle_id?: number;
  @IsOptional() @IsBoolean() is_active?: boolean;
}
