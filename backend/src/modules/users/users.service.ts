import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './user.entity';
import { PaginationDto, PaginatedResult } from '../../common/dto';
import { AccountStatus } from '../../common/enums';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  async findAll(query: PaginationDto): Promise<PaginatedResult<Partial<User>>> {
    const { page = 1, limit = 20, search, sortBy = 'id', sortOrder = 'ASC' } = query;
    const where: any = {};
    if (search) {
      where.full_name = Like(`%${search}%`);
    }

    const [items, total] = await this.repo.findAndCount({
      where,
      order: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
      select: ['id', 'full_name', 'email', 'phone', 'role', 'status', 'department_id', 'f2a_enabled', 'last_login_at', 'created_at'],
    });

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: number): Promise<Partial<User>> {
    const user = await this.repo.findOne({
      where: { id },
      select: ['id', 'full_name', 'email', 'phone', 'role', 'status', 'department_id', 'employee_id', 'f2a_enabled', 'last_login_at', 'created_at'],
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: number, data: Partial<User>): Promise<Partial<User>> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    // Never allow password update through this method
    delete (data as any).password_hash;
    delete (data as any).refresh_token_hash;

    await this.repo.update(id, data);
    return this.findById(id);
  }

  async suspend(id: number): Promise<{ message: string }> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    await this.repo.update(id, { status: AccountStatus.SUSPENDED });
    return { message: 'User suspended' };
  }

  async reactivate(id: number): Promise<{ message: string }> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    await this.repo.update(id, { status: AccountStatus.ACTIVE });
    return { message: 'User reactivated' };
  }

  async adminResetPassword(id: number, newPassword: string): Promise<{ message: string }> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    const hash = await bcrypt.hash(newPassword, 12);
    await this.repo.update(id, { password_hash: hash });
    return { message: 'Password reset by admin' };
  }

  async delete(id: number): Promise<{ message: string }> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    await this.repo.update(id, { status: AccountStatus.INACTIVE });
    return { message: 'User deactivated' };
  }
}
