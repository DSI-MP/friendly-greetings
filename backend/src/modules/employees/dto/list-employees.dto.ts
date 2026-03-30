import { IsOptional, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto';

export class ListEmployeesDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  departmentId?: number;
}
