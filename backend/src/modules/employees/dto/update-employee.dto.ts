import { IsOptional, IsString, IsNumber, IsBoolean, IsEnum } from 'class-validator';
import { AccountStatus, SelfRegRole } from '../../../common/enums';

export class UpdateEmployeeDto {
  @IsOptional() @IsString() full_name?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() emp_no?: string;
  @IsOptional() @IsNumber() department_id?: number;
  @IsOptional() @IsNumber() user_id?: number;
  @IsOptional() @IsNumber() place_id?: number;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
  @IsOptional() @IsEnum(AccountStatus) status?: AccountStatus;
  @IsOptional() @IsEnum(SelfRegRole) register_as?: SelfRegRole;
  @IsOptional() @IsBoolean() is_active?: boolean;
}
