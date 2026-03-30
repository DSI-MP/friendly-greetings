import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Department } from './department.entity';
import { PaginationDto, PaginatedResult } from '../../common/dto';

@Injectable()
export class DepartmentsService {
  constructor(@InjectRepository(Department) private repo: Repository<Department>) {}

  async findAll(query: PaginationDto): Promise<PaginatedResult<Department>> {
    const { page = 1, limit = 50, search, sortBy = 'name', sortOrder = 'ASC' } = query;
    const where: any = {};
    if (search) where.name = Like(`%${search}%`);

    const [items, total] = await this.repo.findAndCount({
      where,
      order: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findAllPublic(): Promise<{ id: number; name: string }[]> {
    return this.repo.find({ where: { is_active: true }, select: ['id', 'name'], order: { name: 'ASC' } });
  }

  async create(data: Partial<Department>): Promise<Department> {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: number, data: Partial<Department>): Promise<Department> {
    const dept = await this.repo.findOne({ where: { id } });
    if (!dept) throw new NotFoundException('Department not found');

    await this.repo.update(id, data);
    const updated = await this.repo.findOne({ where: { id } });
    if (!updated) throw new NotFoundException('Department not found after update');

    return updated;
  }
}
