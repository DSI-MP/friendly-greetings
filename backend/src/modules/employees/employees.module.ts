import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { BulkUploadService } from './bulk-upload.service';
import { Employee } from './employee.entity';
import { User } from '../users/user.entity';
import { Place } from '../places/place.entity';
import { Department } from '../departments/department.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Employee, User, Place, Department]),
    MulterModule.register(),
  ],
  controllers: [EmployeesController],
  providers: [EmployeesService, BulkUploadService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
