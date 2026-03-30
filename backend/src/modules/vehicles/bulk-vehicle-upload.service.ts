import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Vehicle } from './vehicle.entity';
import { VehicleType } from '../../common/enums';

export interface BulkVehicleUploadResult {
  success: boolean;
  totalRecords: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: { row: number; message: string }[];
  updates: { row: number; regNo: string; fields: string[] }[];
}

interface ParsedVehicleRow {
  rowNum: number;
  registration_no: string;
  type: VehicleType;
  capacity: number;
  soft_overflow: number;
  make?: string;
  model?: string;
  driver_name?: string;
  driver_phone?: string;
  driver_license_no?: string;
  is_active: boolean;
}

@Injectable()
export class BulkVehicleUploadService {
  private readonly logger = new Logger(BulkVehicleUploadService.name);

  constructor(
    @InjectRepository(Vehicle) private vehicleRepo: Repository<Vehicle>,
    private dataSource: DataSource,
  ) {}

  async processBulkUpload(rows: any[]): Promise<BulkVehicleUploadResult> {
    const result: BulkVehicleUploadResult = {
      success: false,
      totalRecords: rows.length,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      updates: [],
    };

    this.logger.log(`Starting vehicle bulk upload: ${rows.length} rows`);

    if (rows.length === 0) return result;

    // Log headers
    const rawHeaders = Object.keys(rows[0]);
    const normalizedHeaders = rawHeaders.map(h => `"${h}" → "${this.normalizeKey(h)}"`);
    this.logger.log(`Excel headers: ${normalizedHeaders.join(', ')}`);

    const headerError = this.validateHeaders(rows[0]);
    if (headerError) {
      result.errors.push({ row: 1, message: headerError });
      result.failed = result.totalRecords;
      return result;
    }

    // Parse all rows
    const parsed: ParsedVehicleRow[] = [];
    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;
      const p = this.parseRow(rows[i], rowNum, result);
      if (p) parsed.push(p);
    }

    if (parsed.length === 0) {
      result.success = false;
      return result;
    }

    // Check for duplicates within file
    const seenRegs = new Map<string, number>();
    for (const row of parsed) {
      const key = row.registration_no.toUpperCase();
      if (seenRegs.has(key)) {
        result.errors.push({ row: row.rowNum, message: `Duplicate registration "${row.registration_no}" (also in row ${seenRegs.get(key)})` });
        result.failed = result.totalRecords;
        return result;
      }
      seenRegs.set(key, row.rowNum);
    }

    // Pre-load existing vehicles
    const existingVehicles = await this.vehicleRepo.find();
    const vehicleByReg = new Map<string, Vehicle>();
    for (const v of existingVehicles) {
      vehicleByReg.set(v.registration_no.toUpperCase().trim(), v);
    }

    // Process in a transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (let idx = 0; idx < parsed.length; idx++) {
        const row = parsed[idx];
        const spName = `sp_veh_${idx}`;
        try {
          await queryRunner.query(`SAVEPOINT ${spName}`);
          await this.processRow(row, result, vehicleByReg, queryRunner);
          await queryRunner.query(`RELEASE SAVEPOINT ${spName}`);
        } catch (err: any) {
          await queryRunner.query(`ROLLBACK TO SAVEPOINT ${spName}`);
          this.logger.error(`Row ${row.rowNum}: ${err.message}`);
          result.errors.push({ row: row.rowNum, message: `${row.registration_no}: ${err.message}` });
          result.failed++;
        }
      }
      await queryRunner.commitTransaction();
      result.success = result.failed === 0;
      this.logger.log(`Vehicle bulk upload: created=${result.created}, updated=${result.updated}, skipped=${result.skipped}, failed=${result.failed}`);
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Transaction rolled back: ${err.message}`);
      result.success = false;
      if (result.errors.length === 0) {
        result.errors = [{ row: 0, message: `Transaction failed: ${err.message}` }];
      }
    } finally {
      await queryRunner.release();
    }

    return result;
  }

  private async processRow(
    row: ParsedVehicleRow,
    result: BulkVehicleUploadResult,
    vehicleByReg: Map<string, Vehicle>,
    queryRunner: any,
  ) {
    const existing = vehicleByReg.get(row.registration_no.toUpperCase().trim());

    if (existing) {
      // Update existing vehicle
      const changes: Partial<Vehicle> = {};
      const fieldNames: string[] = [];

      if (existing.type !== row.type) { changes.type = row.type; fieldNames.push('type'); }
      if (existing.capacity !== row.capacity) { changes.capacity = row.capacity; fieldNames.push('capacity'); }
      if (existing.soft_overflow !== row.soft_overflow) { changes.soft_overflow = row.soft_overflow; fieldNames.push('soft_overflow'); }
      if ((existing.make || '') !== (row.make || '')) { changes.make = row.make || undefined; fieldNames.push('make'); }
      if ((existing.model || '') !== (row.model || '')) { changes.model = row.model || undefined; fieldNames.push('model'); }
      if ((existing.driver_name || '') !== (row.driver_name || '')) { changes.driver_name = row.driver_name || undefined; fieldNames.push('driver_name'); }
      if ((existing.driver_phone || '') !== (row.driver_phone || '')) { changes.driver_phone = row.driver_phone || undefined; fieldNames.push('driver_phone'); }
      if ((existing.driver_license_no || '') !== (row.driver_license_no || '')) { changes.driver_license_no = row.driver_license_no || undefined; fieldNames.push('driver_license_no'); }
      if (existing.is_active !== row.is_active) { changes.is_active = row.is_active; fieldNames.push('is_active'); }

      if (fieldNames.length === 0) {
        result.skipped++;
        return;
      }

      await queryRunner.manager.update(Vehicle, existing.id, changes);
      result.updated++;
      result.updates.push({ row: row.rowNum, regNo: row.registration_no, fields: fieldNames });
    } else {
      // Create new vehicle
      const vehicle = queryRunner.manager.create(Vehicle, {
        registration_no: row.registration_no,
        type: row.type,
        capacity: row.capacity,
        soft_overflow: row.soft_overflow,
        make: row.make || undefined,
        model: row.model || undefined,
        driver_name: row.driver_name || undefined,
        driver_phone: row.driver_phone || undefined,
        driver_license_no: row.driver_license_no || undefined,
        is_active: row.is_active,
      });
      const saved = await queryRunner.manager.save(Vehicle, vehicle);
      vehicleByReg.set(row.registration_no.toUpperCase().trim(), saved);
      result.created++;
    }
  }

  private validateHeaders(firstRow: Record<string, any>): string | null {
    if (!firstRow) return 'Excel file is empty';
    const normalized = this.normalizeRowKeys(firstRow);
    const required = [
      { label: 'Registration No', aliases: ['registration_no', 'reg_no', 'vehicle_no', 'plate_no', 'number_plate', 'registration_number'] },
      { label: 'Type', aliases: ['type', 'vehicle_type'] },
      { label: 'Capacity', aliases: ['capacity', 'seating_capacity', 'seats'] },
    ];
    const missing = required.filter(g => !g.aliases.some(a => normalized[a] !== undefined)).map(g => g.label);
    if (missing.length > 0) return `Missing required column(s): ${missing.join(', ')}`;
    return null;
  }

  private parseRow(row: any, rowNum: number, result: BulkVehicleUploadResult): ParsedVehicleRow | null {
    const n = this.normalizeRowKeys(row);

    const registration_no = this.getString(n, ['registration_no', 'reg_no', 'vehicle_no', 'plate_no', 'number_plate', 'registration_number']).trim();
    const typeRaw = this.getString(n, ['type', 'vehicle_type']).trim().toUpperCase();
    const capacityRaw = this.getValue(n, ['capacity', 'seating_capacity', 'seats']);
    const softOverflowRaw = this.getValue(n, ['soft_overflow', 'overflow', 'extra_seats']);
    const make = this.getString(n, ['make', 'manufacturer', 'brand']).trim();
    const model = this.getString(n, ['model', 'vehicle_model']).trim();
    const driverName = this.getString(n, ['driver_name', 'permanent_driver', 'driver']).trim();
    const driverPhone = this.getString(n, ['driver_phone', 'driver_mobile', 'driver_contact']).trim();
    const driverLicense = this.getString(n, ['driver_license_no', 'driver_license', 'license_no', 'license_number']).trim();
    const isActiveRaw = this.getString(n, ['is_active', 'active', 'status']).trim().toUpperCase();

    if (!registration_no) { result.errors.push({ row: rowNum, message: 'Registration No is required' }); result.failed++; return null; }
    if (!typeRaw) { result.errors.push({ row: rowNum, message: 'Vehicle type is required' }); result.failed++; return null; }

    let type: VehicleType;
    if (typeRaw === 'VAN' || typeRaw === 'V') type = VehicleType.VAN;
    else if (typeRaw === 'BUS' || typeRaw === 'B') type = VehicleType.BUS;
    else { result.errors.push({ row: rowNum, message: `Invalid vehicle type: "${typeRaw}". Use VAN or BUS` }); result.failed++; return null; }

    const capacity = parseInt(String(capacityRaw), 10);
    if (isNaN(capacity) || capacity <= 0) { result.errors.push({ row: rowNum, message: `Invalid capacity: "${capacityRaw}"` }); result.failed++; return null; }

    const soft_overflow = softOverflowRaw ? parseInt(String(softOverflowRaw), 10) : 0;

    // is_active: default true, accept FALSE/NO/INACTIVE/0
    let is_active = true;
    if (isActiveRaw && ['FALSE', 'NO', 'INACTIVE', '0', 'N'].includes(isActiveRaw)) {
      is_active = false;
    }

    return {
      rowNum, registration_no, type, capacity,
      soft_overflow: isNaN(soft_overflow) ? 0 : soft_overflow,
      make: make || undefined, model: model || undefined,
      driver_name: driverName || undefined,
      driver_phone: driverPhone || undefined,
      driver_license_no: driverLicense || undefined,
      is_active,
    };
  }

  private normalizeKey(key: string): string {
    return key.toLowerCase().replace(/[\s\-\.\/]+/g, '_').replace(/[^a-z0-9_]/g, '').replace(/_+/g, '_').replace(/^_|_$/g, '');
  }

  private normalizeRowKeys(row: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      out[this.normalizeKey(k)] = v;
    }
    return out;
  }

  private getString(row: Record<string, any>, aliases: string[]): string {
    for (const a of aliases) {
      const v = row[a];
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
    }
    return '';
  }

  private getValue(row: Record<string, any>, aliases: string[]): any {
    for (const a of aliases) {
      if (row[a] !== undefined && row[a] !== null && String(row[a]).trim() !== '') return row[a];
    }
    return undefined;
  }
}
