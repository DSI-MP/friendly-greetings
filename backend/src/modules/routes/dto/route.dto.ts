import { IsOptional, IsString, IsNumber, IsBoolean, IsNotEmpty } from 'class-validator';

export class CreateRouteDto {
  @IsNotEmpty() @IsString() code: string;
  @IsNotEmpty() @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() bearing_from_depot?: number;
  @IsOptional() @IsNumber() corridor_id?: number;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

export class UpdateRouteDto {
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsNumber() bearing_from_depot?: number;
  @IsOptional() @IsNumber() corridor_id?: number;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

export class CreateCorridorDto {
  @IsNotEmpty() @IsString() name: string;
  @IsOptional() @IsNumber() bearing_start?: number;
  @IsOptional() @IsNumber() bearing_end?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

export class UpdateCorridorDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsNumber() bearing_start?: number;
  @IsOptional() @IsNumber() bearing_end?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() is_active?: boolean;
}
