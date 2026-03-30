import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SelfServiceController } from './self-service.controller';
import { SelfServiceService } from './self-service.service';
import { LocationChangeRequest } from './location-change-request.entity';
import { Employee } from '../employees/employee.entity';
import { Place } from '../places/place.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LocationChangeRequest, Employee, Place])],
  controllers: [SelfServiceController],
  providers: [SelfServiceService],
})
export class SelfServiceModule {}
