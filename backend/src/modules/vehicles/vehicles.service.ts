import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Vehicle } from './vehicle.entity';
import { PaginationDto, PaginatedResult } from '../../common/dto';

@Injectable()
export class VehiclesService {
  constructor(@InjectRepository(Vehicle) private repo: Repository<Vehicle>) {}

  async findAll(query: PaginationDto): Promise<PaginatedResult<Vehicle>> {
    const { page = 1, limit = 20, search, sortBy = 'id', sortOrder = 'ASC' } = query;
    const where: any = {};
    if (search) where.registration_no = Like(`%${search}%`);

    const [items, total] = await this.repo.findAndCount({
      where, order: { [sortBy]: sortOrder },
      skip: (page - 1) * limit, take: limit,
    });
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async create(data: Partial<Vehicle>): Promise<Vehicle> {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: number, data: Partial<Vehicle>): Promise<Vehicle> {
    const v = await this.repo.findOne({ where: { id } });
    if (!v) throw new NotFoundException('Vehicle not found');

    await this.repo.update(id, data);
    const updated = await this.repo.findOne({ where: { id } });
    if (!updated) throw new NotFoundException('Vehicle not found after update');

    return updated;
  }

  async findAvailable(): Promise<Vehicle[]> {
    return this.repo.find({ where: { is_active: true }, order: { type: 'ASC', capacity: 'DESC' } });
  }
}
