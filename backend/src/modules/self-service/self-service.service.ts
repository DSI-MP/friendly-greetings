import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LocationChangeRequest, LocationChangeStatus } from './location-change-request.entity';
import { Employee } from '../employees/employee.entity';
import { Place } from '../places/place.entity';

@Injectable()
export class SelfServiceService {
  constructor(
    @InjectRepository(LocationChangeRequest) private lcrRepo: Repository<LocationChangeRequest>,
    @InjectRepository(Employee) private empRepo: Repository<Employee>,
    @InjectRepository(Place) private placeRepo: Repository<Place>,
  ) {}

  async requestLocationChange(userId: number, data: { locationName: string; lat: number; lng: number; reason?: string }) {
    const name = data.locationName?.trim();
    if (!name) throw new BadRequestException('Location name is required');
    if (!data.lat || !data.lng) throw new BadRequestException('Coordinates are required');

    // Check if location name already exists in places table
    const existingPlace = await this.placeRepo.findOne({ where: { title: name } });
    if (existingPlace) {
      throw new BadRequestException('This location name already exists in the database. Please use a unique name (e.g. your Employee ID).');
    }

    // Find employee by user_id
    const emp = await this.empRepo.findOne({ where: { user_id: userId } });

    // Block if pending request exists for same name
    const existing = await this.lcrRepo.findOne({
      where: { user_id: userId, place_title: name, status: LocationChangeStatus.PENDING },
    });
    if (existing) throw new BadRequestException('You already have a pending request with this location name');

    const req = this.lcrRepo.create({
      user_id: userId,
      employee_id: emp?.id,
      place_title: name,
      lat: data.lat,
      lng: data.lng,
      reason: data.reason?.trim() || undefined,
    });
    return this.lcrRepo.save(req);
  }

  async findAllRequests(status?: string) {
    const where: any = {};
    if (status) where.status = status;
    return this.lcrRepo.find({ where, order: { created_at: 'DESC' } });
  }

  async approveRequest(id: number, reviewerId: number, note?: string) {
    const req = await this.lcrRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== LocationChangeStatus.PENDING) throw new BadRequestException('Request is not pending');

    // Create a new place in the database
    const newPlace = this.placeRepo.create({
      title: req.place_title || `Location-${req.id}`,
      latitude: req.lat,
      longitude: req.lng,
      is_active: true,
    });
    const savedPlace = await this.placeRepo.save(newPlace);

    // Update employee location
    if (req.employee_id) {
      await this.empRepo.update(req.employee_id, {
        place_id: savedPlace.id,
        lat: req.lat,
        lng: req.lng,
      });
    }

    await this.lcrRepo.update(id, {
      status: LocationChangeStatus.APPROVED,
      place_id: savedPlace.id,
      reviewed_by: reviewerId,
      review_note: note?.trim() || undefined,
      reviewed_at: new Date(),
    });

    return { message: 'Location change approved, new place created and employee location updated' };
  }

  async rejectRequest(id: number, reviewerId: number, note?: string) {
    const req = await this.lcrRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== LocationChangeStatus.PENDING) throw new BadRequestException('Request is not pending');

    await this.lcrRepo.update(id, {
      status: LocationChangeStatus.REJECTED,
      reviewed_by: reviewerId,
      review_note: note?.trim() || undefined,
      reviewed_at: new Date(),
    });

    return { message: 'Location change rejected' };
  }
}
