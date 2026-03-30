import { IsOptional, IsNumber, IsArray, ArrayMinSize } from 'class-validator';

export class ManualAdjustDto {
  @IsOptional() @IsNumber() vehicleId?: number;
  @IsOptional() @IsNumber() driverId?: number;
  @IsOptional() @IsArray() employeeIds?: number[];
}

export class AssignVehicleDto {
  @IsNumber() vehicleId: number;
}

export class SplitAssignDto {
  @IsArray()
  @ArrayMinSize(2, { message: 'At least 2 vehicle IDs required to split a group' })
  @IsNumber({}, { each: true })
  vehicleIds: number[];
}
