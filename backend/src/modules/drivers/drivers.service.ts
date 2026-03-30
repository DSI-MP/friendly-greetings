import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Driver } from './driver.entity';
import { PaginationDto, PaginatedResult } from '../../common/dto';

@Injectable()
export class DriversService {
  constructor(@InjectRepository(Driver) private repo: Repository<Driver>) {}

  async findAll(query: PaginationDto): Promise<PaginatedResult<Driver>> {
    const { page = 1, limit = 20, search, sortBy = 'id', sortOrder = 'ASC' } = query;
    const where: any = {};
    if (search) where.full_name = Like(`%${search}%`);
    const [items, total] = await this.repo.findAndCount({
      where, order: { [sortBy]: sortOrder }, skip: (page - 1) * limit, take: limit,
    });
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async create(data: Partial<Driver>): Promise<Driver> {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: number, data: Partial<Driver>): Promise<Driver> {
    const d = await this.repo.findOne({ where: { id } });
    if (!d) throw new NotFoundException('Driver not found');

    await this.repo.update(id, data);
    const updated = await this.repo.findOne({ where: { id } });
    if (!updated) throw new NotFoundException('Driver not found after update');

    return updated;
  }
}
