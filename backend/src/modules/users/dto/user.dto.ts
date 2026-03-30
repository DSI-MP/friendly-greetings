import { IsOptional, IsString, IsNumber, IsBoolean, IsEnum } from 'class-validator';
import { AppRole, AccountStatus } from '../../../common/enums';

export class UpdateUserDto {
  @IsOptional() @IsString() full_name?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEnum(AppRole) role?: AppRole;
  @IsOptional() @IsEnum(AccountStatus) status?: AccountStatus;
  @IsOptional() @IsNumber() department_id?: number;
  @IsOptional() @IsNumber() employee_id?: number;
  @IsOptional() @IsBoolean() f2a_enabled?: boolean;
  @IsOptional() @IsString() password?: string;
}
