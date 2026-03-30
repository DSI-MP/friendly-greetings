import { IsOptional, IsString, IsNumber, IsBoolean, IsNotEmpty } from 'class-validator';

export class CreatePlaceDto {
  @IsOptional() @IsString() external_place_id?: string;
  @IsNotEmpty() @IsString() title: string;
  @IsOptional() @IsString() address?: string;
  @IsNotEmpty() @IsNumber() latitude: number;
  @IsNotEmpty() @IsNumber() longitude: number;
  @IsOptional() @IsNumber() gn_division_id?: number;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

export class UpdatePlaceDto {
  @IsOptional() @IsString() external_place_id?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsNumber() gn_division_id?: number;
  @IsOptional() @IsBoolean() is_active?: boolean;
}
