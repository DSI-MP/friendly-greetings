import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit.entity';
import { AuditAction } from '../../common/enums';
import { PaginationDto, PaginatedResult } from '../../common/dto';

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private repo: Repository<AuditLog>) {}

  async log(data: {
    action: AuditAction; entityType: string; entityId?: number;
    performedByUserId?: number; oldValues?: any; newValues?: any;
    ipAddress?: string; userAgent?: string;
  }) {
    return this.repo.save(this.repo.create({
      action: data.action,
      entity_type: data.entityType,
      entity_id: data.entityId,
      performed_by_user_id: data.performedByUserId,
      old_values: data.oldValues,
      new_values: data.newValues,
      ip_address: data.ipAddress,
      user_agent: data.userAgent,
    }));
  }

  async findAll(query: PaginationDto): Promise<PaginatedResult<AuditLog>> {
    const { page = 1, limit = 50, sortOrder = 'DESC' } = query;
    const [items, total] = await this.repo.findAndCount({
      order: { created_at: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findByEntity(entityType: string, entityId: number): Promise<AuditLog[]> {
    return this.repo.find({
      where: { entity_type: entityType, entity_id: entityId },
      order: { created_at: 'DESC' },
    });
  }
}
