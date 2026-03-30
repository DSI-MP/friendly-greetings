import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Route, RouteCorridor } from './route.entity';
import { PaginationDto, PaginatedResult } from '../../common/dto';

@Injectable()
export class RoutesService {
  constructor(
    @InjectRepository(Route) private routeRepo: Repository<Route>,
    @InjectRepository(RouteCorridor) private corridorRepo: Repository<RouteCorridor>,
  ) {}

  async findAllRoutes(query: PaginationDto): Promise<PaginatedResult<Route>> {
    const { page = 1, limit = 50, search, sortBy = 'code', sortOrder = 'ASC' } = query;
    const where: any = {};
    if (search) where.name = Like(`%${search}%`);
    const [items, total] = await this.routeRepo.findAndCount({
      where, order: { [sortBy]: sortOrder }, skip: (page - 1) * limit, take: limit,
    });
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async createRoute(data: Partial<Route>): Promise<Route> {
    return this.routeRepo.save(this.routeRepo.create(data));
  }

  async updateRoute(id: number, data: Partial<Route>): Promise<Route> {
    const r = await this.routeRepo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Route not found');

    await this.routeRepo.update(id, data);
    const updated = await this.routeRepo.findOne({ where: { id } });
    if (!updated) throw new NotFoundException('Route not found after update');

    return updated;
  }

  async findAllCorridors(query: PaginationDto): Promise<PaginatedResult<RouteCorridor>> {
    const { page = 1, limit = 50 } = query;
    const [items, total] = await this.corridorRepo.findAndCount({
      order: { name: 'ASC' }, skip: (page - 1) * limit, take: limit,
    });
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async createCorridor(data: Partial<RouteCorridor>): Promise<RouteCorridor> {
    return this.corridorRepo.save(this.corridorRepo.create(data));
  }

  async updateCorridor(id: number, data: Partial<RouteCorridor>): Promise<RouteCorridor> {
    const c = await this.corridorRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Corridor not found');

    await this.corridorRepo.update(id, data);
    const updated = await this.corridorRepo.findOne({ where: { id } });
    if (!updated) throw new NotFoundException('Corridor not found after update');

    return updated;
  }
}
