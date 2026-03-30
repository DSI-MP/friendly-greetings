import { IsArray, ValidateNested, IsNotEmpty, IsEmail, IsOptional, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class BulkEmployeeRow {
  @IsNotEmpty()
  empNo: string;

  @IsNotEmpty()
  fullName: string;

  @IsNotEmpty()
  phone: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  locationName?: string;
}

export interface BulkUploadResult {
  totalRecords: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: { row: number; message: string }[];
  updates: { row: number; empNo: string; fields: string[] }[];
}
