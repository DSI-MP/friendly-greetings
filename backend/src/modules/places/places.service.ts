import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Place, GnDivision } from './place.entity';
import { ImportLog } from '../settings/settings.entity';
import { PaginationDto, PaginatedResult } from '../../common/dto';

@Injectable()
export class PlacesService {
  constructor(
    @InjectRepository(Place) private placeRepo: Repository<Place>,
    @InjectRepository(GnDivision) private gnRepo: Repository<GnDivision>,
    @InjectRepository(ImportLog) private importLogRepo: Repository<ImportLog>,
  ) {}

  async findAll(query: PaginationDto): Promise<PaginatedResult<Place>> {
    const { page = 1, limit = 50, search, sortBy = 'title', sortOrder = 'ASC' } = query;
    const where: any = {};
    if (search) where.title = Like(`%${search}%`);

    const [items, total] = await this.placeRepo.findAndCount({
      where, order: { [sortBy]: sortOrder },
      skip: (page - 1) * limit, take: limit,
    });
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findAllPublic(): Promise<{ id: number; title: string; address?: string }[]> {
    return this.placeRepo.find({
      where: { is_active: true },
      select: ['id', 'title', 'address'],
      order: { title: 'ASC' },
    });
  }

  async create(data: Partial<Place>): Promise<Place> {
    return this.placeRepo.save(this.placeRepo.create(data));
  }

  async update(id: number, data: Partial<Place>): Promise<Place> {
    const place = await this.placeRepo.findOne({ where: { id } });
    if (!place) throw new NotFoundException('Place not found');

    await this.placeRepo.update(id, data);
    const updated = await this.placeRepo.findOne({ where: { id } });
    if (!updated) throw new NotFoundException('Place not found after update');

    return updated;
  }

  async importFromJson(items: any[], userId?: number): Promise<any> {
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errorCount = 0;
    const errors: any[] = [];

    for (const item of items) {
      try {
        const title = typeof item?.title === 'string' ? item.title.trim().replace(/\s+/g, ' ') : '';
        const address = typeof item?.address === 'string' ? item.address.trim() || undefined : undefined;
        const lat = this.toFiniteNumber(item?.lat ?? item?.location?.lat ?? item?.latitude);
        const lng = this.toFiniteNumber(item?.lng ?? item?.location?.lng ?? item?.longitude);
        const externalId = this.toOptionalString(item?.placeId ?? item?.external_place_id);

        if (!title) {
          errors.push({ item, error: 'Missing place title' });
          errorCount++;
          continue;
        }
        if (lat === undefined || lng === undefined) {
          errors.push({ item, error: 'Missing coordinates' });
          errorCount++;
          continue;
        }
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          errors.push({ item, error: 'Coordinates out of range' });
          errorCount++;
          continue;
        }

        let existing: Place | null = null;
        if (externalId) {
          existing = await this.placeRepo.findOne({ where: { external_place_id: externalId } });
        }
        if (!existing) {
          existing = await this.placeRepo
            .createQueryBuilder('p')
            .where("LOWER(REGEXP_REPLACE(TRIM(p.title), '\\s+', ' ', 'g')) = :title", { title: title.toLowerCase() })
            .andWhere('p.is_active = true')
            .getOne();
        }

        if (existing) {
          const changed: Partial<Place> = {};
          if (!existing.external_place_id && externalId) changed.external_place_id = externalId;
          if ((existing.address ?? '') !== (address ?? '')) changed.address = address;
          const currentLat = parseFloat(String(existing.latitude));
          const currentLng = parseFloat(String(existing.longitude));
          if (currentLat !== lat) changed.latitude = lat;
          if (currentLng !== lng) changed.longitude = lng;
          if (!existing.is_active) changed.is_active = true;

          if (Object.keys(changed).length > 0) {
            await this.placeRepo.update(existing.id, changed);
            updated++;
          } else {
            skipped++;
          }
        } else {
          await this.placeRepo.save(this.placeRepo.create({
            external_place_id: externalId,
            title,
            address,
            latitude: lat,
            longitude: lng,
            is_active: true,
          }));
          created++;
        }
      } catch (err) {
        errors.push({ item, error: (err as Error).message });
        errorCount++;
      }
    }

    const importLog = this.importLogRepo.create({
      entity_type: 'places',
      total_records: items.length,
      success_count: created + updated,
      error_count: errorCount,
      errors: errors.length ? errors : undefined,
      imported_by_user_id: userId,
    });
    await this.importLogRepo.save(importLog);

    return { total: items.length, created, updated, skipped, success: created + updated, errors: errorCount, details: errors };
  }

  private toFiniteNumber(value: unknown): number | undefined {
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
  }

  private toOptionalString(value: unknown): string | undefined {
    const str = String(value ?? '').trim();
    return str ? str : undefined;
  }

}
