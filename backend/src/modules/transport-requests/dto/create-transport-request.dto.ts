import {
  ArrayNotEmpty, IsArray, IsDateString, IsEnum, IsInt,
  IsNotEmpty, IsOptional, IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RequestStatus } from '../../../common/enums';
import { PaginationDto } from '../../../common/dto';

/* ─── Create ─── */

export class CreateTransportRequestDto {
  /** Optional — ignored for HOD (derived from auth). Required for Admin/Super Admin. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  departmentId?: number;

  @IsNotEmpty()
  @IsDateString()
  requestDate: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  otTime?: string;
}

/* ─── Update (draft only) ─── */

export class UpdateTransportRequestDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  requestDate?: string;

  @IsOptional()
  @IsString()
  otTime?: string;
}

/* ─── Add employees ─── */

export class AddEmployeesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  employeeIds: number[];
}

/* ─── Rejection reason ─── */

export class RejectDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

/* ─── List / Query ─── */

export class ListTransportRequestsDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  departmentId?: number;

  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;
}
