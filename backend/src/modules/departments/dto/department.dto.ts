import { IsOptional, IsString, IsBoolean, IsNotEmpty } from 'class-validator';

export class CreateDepartmentDto {
  @IsNotEmpty() @IsString() name: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

export class UpdateDepartmentDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsBoolean() is_active?: boolean;
}
