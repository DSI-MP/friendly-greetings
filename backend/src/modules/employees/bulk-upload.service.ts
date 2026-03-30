import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Employee } from './employee.entity';
import { User } from '../users/user.entity';
import { Place } from '../places/place.entity';
import { AppRole, AccountStatus } from '../../common/enums';

export interface BulkUploadResult {
  success: boolean;
  totalRecords: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: { row: number; message: string }[];
  updates: { row: number; empNo: string; fields: string[] }[];
  warnings?: { row: number; message: string }[];
}

interface ParsedRow {
  rowNum: number;
  empNo: string;
  fullName: string;
  phone: string;
  email: string;
  lat?: number;
  lng?: number;
  locationName?: string;
}

interface FailureDebugState {
  logged: boolean;
}

interface PlaceResolutionResult {
  placeId?: number;
  cacheMatch: boolean;
  dbMatch: boolean;
  createAttempted: boolean;
  failureReason?: string;
}

/** Safely convert a value to integer. Returns NaN if not valid. */
function toInt(val: any): number {
  if (val === null || val === undefined) return NaN;
  const n = typeof val === 'number' ? val : parseInt(String(val), 10);
  return Number.isFinite(n) ? n : NaN;
}

/** Ensure a value is a valid integer, throw if not */
function requireInt(val: any, fieldName: string): number {
  const n = toInt(val);
  if (isNaN(n)) throw new Error(`${fieldName} must be a valid integer, got: ${JSON.stringify(val)}`);
  return n;
}

/** Optionally convert to int, return undefined if empty/null */
function optionalInt(val: any): number | undefined {
  if (val === null || val === undefined) return undefined;
  const n = toInt(val);
  return isNaN(n) ? undefined : n;
}

@Injectable()
export class BulkUploadService {
  private readonly logger = new Logger(BulkUploadService.name);

  constructor(
    @InjectRepository(Employee) private empRepo: Repository<Employee>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Place) private placeRepo: Repository<Place>,
    private dataSource: DataSource,
  ) {}

  async processBulkUpload(
    rows: any[],
    departmentId: number,
    _uploadedBy: number,
  ): Promise<BulkUploadResult> {
    // Ensure departmentId is a proper integer
    departmentId = requireInt(departmentId, 'departmentId');

    const result: BulkUploadResult = {
      success: false,
      totalRecords: rows.length,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      updates: [],
      warnings: [],
    };

    this.logger.log(`Starting bulk upload: ${rows.length} rows, departmentId=${departmentId}`);

    // Log detected headers from first row
    if (rows.length > 0) {
      const rawHeaders = Object.keys(rows[0]);
      const normalizedHeaders = rawHeaders.map(h => `"${h}" → "${this.normalizeHeaderKey(h)}"`);
      this.logger.log(`Excel headers detected: ${normalizedHeaders.join(', ')}`);
    }

    const headerError = this.validateHeaders(rows[0]);
    if (headerError) {
      result.errors.push({ row: 1, message: headerError });
      result.failed = result.totalRecords;
      this.logger.error(headerError);
      return result;
    }

    // Step 1: Parse & validate all rows
    const parsed: ParsedRow[] = [];
    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // Excel row (header is row 1)
      const row = rows[i];
      const p = this.parseAndValidateRow(row, rowNum, result);
      if (p) parsed.push(p);
    }

    if (parsed.length === 0) {
      this.logger.warn('No valid rows after parsing');
      result.success = false;
      return result;
    }

    const sampleRow = parsed[0];
    this.logger.log(`Sample parsed row: row=${sampleRow.rowNum}, empNo=${sampleRow.empNo}, email=${sampleRow.email}, location_name=${sampleRow.locationName ?? ''}, latitude=${sampleRow.lat ?? ''}, longitude=${sampleRow.lng ?? ''}`);

    // Step 2: Check for duplicates WITHIN the file
    const dupError = this.checkInFileDuplicates(parsed);
    if (dupError) {
      result.errors.push({ row: 0, message: dupError });
      result.failed = result.totalRecords;
      result.created = 0;
      result.updated = 0;
      result.skipped = 0;
      this.logger.error(`Duplicate entries in file: ${dupError}`);
      return result;
    }

    // Step 3: Pre-load existing data
    const allEmails = parsed.map(r => r.email);
    const allEmpNos = parsed.map(r => r.empNo);

    const [existingEmps, existingUsers, existingPlaces] = await Promise.all([
      this.empRepo.createQueryBuilder('e')
        .where('LOWER(e.email) IN (:...emails) OR e.emp_no IN (:...empNos)', {
          emails: allEmails,
          empNos: allEmpNos,
        })
        .getMany(),
      this.userRepo.createQueryBuilder('u')
        .where('LOWER(u.email) IN (:...emails)', { emails: allEmails })
        .getMany(),
      this.placeRepo.find({ where: { is_active: true } }),
    ]);

    const empByNo = new Map<string, Employee>();
    const empByEmail = new Map<string, Employee>();
    for (const e of existingEmps) {
      if (e.emp_no) empByNo.set(e.emp_no.trim(), e);
      empByEmail.set(e.email.toLowerCase().trim(), e);
    }

    const userByEmail = new Map<string, User>();
    for (const u of existingUsers) {
      userByEmail.set(u.email.toLowerCase().trim(), u);
    }

    const placeByTitle = new Map<string, Place>();
    for (const p of existingPlaces) {
      placeByTitle.set(this.normalizePlaceTitle(p.title), p);
    }

    // Step 3.5: Pre-hash passwords for new employees (batch to avoid per-row bcrypt delay)
    const newRowEmails = new Set<string>();
    for (const row of parsed) {
      const existsByNo = empByNo.has(row.empNo);
      const existsByEmail = empByEmail.has(row.email);
      const userExists = userByEmail.has(row.email);
      if (!existsByNo && !existsByEmail && !userExists) {
        newRowEmails.add(row.email);
      }
    }

    // Batch hash: use a single salt for all new users in this upload for speed
    const passwordHashes = new Map<string, string>();
    if (newRowEmails.size > 0) {
      this.logger.log(`Pre-hashing passwords for ${newRowEmails.size} new employees`);
      const hashPromises: Promise<void>[] = [];
      for (const row of parsed) {
        if (newRowEmails.has(row.email)) {
          hashPromises.push(
            bcrypt.hash(row.empNo, 10).then(hash => { passwordHashes.set(row.email, hash); })
          );
        }
      }
      await Promise.all(hashPromises);
    }

    // Step 4: Process all rows in a single transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const failureDebugState: FailureDebugState = { logged: false };

    try {
      for (let idx = 0; idx < parsed.length; idx++) {
        const row = parsed[idx];
        const spName = `sp_row_${idx}`;
        try {
          await queryRunner.query(`SAVEPOINT ${spName}`);
          await this.processRow(row, departmentId, result, empByNo, empByEmail, userByEmail, placeByTitle, passwordHashes, queryRunner, failureDebugState);
          await queryRunner.query(`RELEASE SAVEPOINT ${spName}`);
        } catch (err: any) {
          await queryRunner.query(`ROLLBACK TO SAVEPOINT ${spName}`);
          if (this.isFatalSystemError(err)) {
            throw err; // bubble up to rollback the whole transaction
          }
          this.logger.error(`Row ${row.rowNum}: Savepoint rolled back: ${err.message}`);
          result.errors.push({ row: row.rowNum, message: `${row.empNo}: ${err.message}` });
          result.failed++;
        }
      }
      await queryRunner.commitTransaction();
      result.success = result.failed === 0;
      this.logger.log(`Bulk upload committed: success=${result.success}, created=${result.created}, updated=${result.updated}, skipped=${result.skipped}, failed=${result.failed}`);
    } catch (err: any) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Transaction rolled back: ${err.message}`, err.stack);
      result.success = false;
      if (result.errors.length === 0) {
        result.errors = [{ row: 0, message: `Transaction failed and rolled back: ${err.message}` }];
      }
      result.failed = Math.max(result.failed, 1);
    } finally {
      await queryRunner.release();
    }

    return result;
  }

  /** Check for duplicate emp_no or email within the same upload file */
  private checkInFileDuplicates(rows: ParsedRow[]): string | null {
    const seenEmails = new Map<string, number>();
    const seenEmpNos = new Map<string, number>();
    const dupEmails: string[] = [];
    const dupEmpNos: string[] = [];

    for (const row of rows) {
      const email = row.email;
      if (seenEmails.has(email)) {
        dupEmails.push(`Email "${row.email}" duplicated in rows ${seenEmails.get(email)} and ${row.rowNum}`);
      } else {
        seenEmails.set(email, row.rowNum);
      }

      const empNo = row.empNo.trim();
      if (seenEmpNos.has(empNo)) {
        dupEmpNos.push(`Employee ID "${row.empNo}" duplicated in rows ${seenEmpNos.get(empNo)} and ${row.rowNum}`);
      } else {
        seenEmpNos.set(empNo, row.rowNum);
      }
    }

    const dups = [...dupEmails, ...dupEmpNos];
    if (dups.length > 0) {
      return `Duplicate entries found in upload file: ${dups.join('; ')}`;
    }
    return null;
  }

  private validateHeaders(firstRow: Record<string, any> | undefined): string | null {
    if (!firstRow) return 'Excel file is empty';

    const normalized = this.normalizeRowKeys(firstRow);
    const requiredGroups = [
      { label: 'Employee ID', aliases: ['emp_id_number', 'employee_id', 'emp_no', 'emp_id', 'employee_number'] },
      { label: 'Employee name', aliases: ['emp_name', 'full_name', 'employee_name', 'name'] },
      { label: 'Mobile number', aliases: ['emp_mobile_number', 'mobile_number', 'phone', 'phone_number', 'mobile'] },
      { label: 'Email', aliases: ['emp_email', 'email'] },
    ];

    const missing = requiredGroups
      .filter((g) => !g.aliases.some((a) => normalized[this.normalizeHeaderKey(a)] !== undefined))
      .map((g) => g.label);

    if (missing.length === 0) return null;

    return `Invalid upload template. Missing required column(s): ${missing.join(', ')}`;
  }

  private parseAndValidateRow(row: any, rowNum: number, result: BulkUploadResult): ParsedRow | null {
    const normalizedRow = this.normalizeRowKeys(row);

    const empNo = this.getRowString(normalizedRow, ['emp_id_number', 'employee_id', 'emp_no', 'emp_id', 'employee_number']).trim();
    const fullName = this.getRowString(normalizedRow, ['emp_name', 'full_name', 'employee_name', 'name']).trim();
    const phone = this.getRowString(normalizedRow, ['emp_mobile_number', 'mobile_number', 'phone', 'phone_number', 'mobile']).trim();
    const email = this.getRowString(normalizedRow, ['emp_email', 'email']).toLowerCase().trim();
    const latRaw = this.getRowValue(normalizedRow, ['latitude', 'lat']);
    const lngRaw = this.getRowValue(normalizedRow, ['longitude', 'lng', 'lon']);
    const locationName = this.getRowString(normalizedRow, [
      'location_name', 'drop_off_location', 'dropoff_location', 'drop_location',
      'destination_location', 'place', 'location',
    ]).trim();

    if (!empNo) { result.errors.push({ row: rowNum, message: 'Employee ID is required' }); result.failed++; return null; }
    if (!fullName) { result.errors.push({ row: rowNum, message: 'Employee name is required' }); result.failed++; return null; }
    if (!phone) { result.errors.push({ row: rowNum, message: 'Mobile number is required' }); result.failed++; return null; }
    if (!email) { result.errors.push({ row: rowNum, message: 'Email is required' }); result.failed++; return null; }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { result.errors.push({ row: rowNum, message: `Invalid email format: ${email}` }); result.failed++; return null; }

    const phoneClean = phone.replace(/[^0-9]/g, '');
    if (!/^[0-9+()\-\s]+$/.test(phone) || phoneClean.length < 9 || phoneClean.length > 15) { result.errors.push({ row: rowNum, message: `Invalid phone number: ${phone}` }); result.failed++; return null; }

    let lat: number | undefined;
    let lng: number | undefined;
    const hasLat = this.hasValue(latRaw);
    const hasLng = this.hasValue(lngRaw);

    if (hasLat) {
      lat = parseFloat(String(latRaw));
      if (isNaN(lat)) { result.errors.push({ row: rowNum, message: 'Invalid latitude value' }); result.failed++; return null; }
      if (lat < -90 || lat > 90) { result.errors.push({ row: rowNum, message: `Latitude out of range: ${lat}` }); result.failed++; return null; }
    }
    if (hasLng) {
      lng = parseFloat(String(lngRaw));
      if (isNaN(lng)) { result.errors.push({ row: rowNum, message: 'Invalid longitude value' }); result.failed++; return null; }
      if (lng < -180 || lng > 180) { result.errors.push({ row: rowNum, message: `Longitude out of range: ${lng}` }); result.failed++; return null; }
    }

    if (locationName && ((lat === undefined) !== (lng === undefined))) {
      result.errors.push({ row: rowNum, message: 'Latitude and longitude must both be provided for a new location name' });
      result.failed++;
      return null;
    }

    return { rowNum, empNo, fullName, phone, email, lat, lng, locationName: locationName || undefined };
  }

  private async processRow(
    row: ParsedRow,
    departmentId: number,
    result: BulkUploadResult,
    empByNo: Map<string, Employee>,
    empByEmail: Map<string, Employee>,
    userByEmail: Map<string, User>,
    placeByTitle: Map<string, Place>,
    passwordHashes: Map<string, string>,
    queryRunner: any,
    failureDebugState: FailureDebugState,
  ) {
    const { rowNum, empNo, fullName, phone, email, lat, lng, locationName } = row;

    try {
      // Resolve place if location name provided
      let placeId: number | undefined;
      if (locationName) {
        const placeResolution = await this.resolvePlace(locationName, lat, lng, placeByTitle, queryRunner);
        placeId = placeResolution.placeId;

        if (placeId === undefined) {
          const failureMessage = `Drop-off location "${locationName}" could not be resolved: ${placeResolution.failureReason ?? 'unknown resolution error'}`;
          result.errors.push({ row: rowNum, message: failureMessage });
          result.failed++;
          this.logFirstPlaceFailure(failureDebugState, {
            rowNum,
            empNo,
            locationName,
            lat,
            lng,
            cacheMatch: placeResolution.cacheMatch,
            dbMatch: placeResolution.dbMatch,
            createAttempted: placeResolution.createAttempted,
            finalReason: placeResolution.failureReason ?? 'unknown resolution error',
          });
          return;
        }

        this.logger.debug(`Row ${rowNum}: Resolved place_id=${placeId} for "${locationName}" (cacheMatch=${placeResolution.cacheMatch}, dbMatch=${placeResolution.dbMatch}, createAttempted=${placeResolution.createAttempted})`);
      }
      // Ensure placeId is a proper integer if set
      placeId = optionalInt(placeId);

      // Check if employee exists by emp_no
      const existingEmp = empByNo.get(empNo);

      if (existingEmp) {
        // === UPDATE existing employee ===
        this.logger.debug(`Row ${rowNum}: Updating existing employee ${empNo}`);

        const changedEmpFields: Partial<Employee> = {};
        const changedUserFields: Partial<User> = {};
        const fieldNames: string[] = [];
        const oldEmail = existingEmp.email;

        // Do not let one HOD silently move an employee from another department.
        const empDeptId = toInt(existingEmp.department_id);
        if (!isNaN(empDeptId) && empDeptId !== departmentId) {
          result.errors.push({ row: rowNum, message: `Employee ${empNo} belongs to another department and cannot be updated by this upload` });
          result.failed++;
          return;
        }

        const linkedUserByEmail = userByEmail.get(email);
        const existingUserId = optionalInt(existingEmp.user_id) ?? optionalInt(linkedUserByEmail?.id);
        if (!optionalInt(existingEmp.user_id) && existingUserId) {
          changedEmpFields.user_id = existingUserId;
          fieldNames.push('employee.user_id (backfill)');
          this.logger.debug(`Row ${rowNum}: Backfilling employees.user_id=${existingUserId} for employee ${existingEmp.id}`);
        }

        if (existingEmp.full_name !== fullName) {
          changedEmpFields.full_name = fullName;
          changedUserFields.full_name = fullName;
          fieldNames.push('full_name');
        }
        if (existingEmp.phone !== phone) {
          changedEmpFields.phone = phone;
          changedUserFields.phone = phone;
          fieldNames.push('phone');
        }
        if (existingEmp.email !== email) {
          const emailUser = userByEmail.get(email);
          if (emailUser && emailUser.id !== existingUserId) {
            result.errors.push({ row: rowNum, message: `Email ${email} is already used by another user` });
            result.failed++;
            return;
          }
          changedEmpFields.email = email;
          changedUserFields.email = email;
          fieldNames.push('email');
        }

        // Update coordinates if provided
        const existingLat = existingEmp.lat != null ? parseFloat(String(existingEmp.lat)) : undefined;
        const existingLng = existingEmp.lng != null ? parseFloat(String(existingEmp.lng)) : undefined;
        if (lat !== undefined && lat !== existingLat) { changedEmpFields.lat = lat; fieldNames.push('lat'); }
        if (lng !== undefined && lng !== existingLng) { changedEmpFields.lng = lng; fieldNames.push('lng'); }

        if (placeId !== undefined && placeId !== optionalInt(existingEmp.place_id)) {
          changedEmpFields.place_id = placeId;
          fieldNames.push('place_id');
        }

        const empId = requireInt(existingEmp.id, 'existingEmp.id');

        // Backfill users.employee_id if missing
        if (existingUserId) {
          const linkedUser = linkedUserByEmail || await queryRunner.manager.findOne(User, { where: { id: existingUserId } });
          if (linkedUser && (linkedUser.employee_id === null || linkedUser.employee_id === undefined || toInt(linkedUser.employee_id) !== empId)) {
            changedUserFields.employee_id = empId;
            fieldNames.push('user.employee_id (backfill)');
            this.logger.debug(`Row ${rowNum}: Backfilling users.employee_id=${empId} for user ${existingUserId}`);
          }
        }

        if (fieldNames.length === 0) {
          this.logger.debug(`Row ${rowNum}: No changes for employee ${empNo}, skipping`);
          result.skipped++;
          return;
        }

        await queryRunner.manager.update(Employee, empId, changedEmpFields);

        // Update linked user too
        if (existingUserId && Object.keys(changedUserFields).length > 0) {
          await queryRunner.manager.update(User, existingUserId, changedUserFields);
        }

        // Update in-memory cache
        Object.assign(existingEmp, changedEmpFields);
        if (changedEmpFields.email) {
          empByEmail.delete(oldEmail);
          empByEmail.set(changedEmpFields.email, existingEmp);
          const cachedUser = userByEmail.get(oldEmail);
          if (cachedUser) {
            userByEmail.delete(oldEmail);
            Object.assign(cachedUser, changedUserFields);
            userByEmail.set(changedEmpFields.email, cachedUser);
          }
        }

        result.updated++;
        result.updates.push({ row: rowNum, empNo, fields: fieldNames });
        this.logger.debug(`Row ${rowNum}: Updated emp ${empNo} (id=${empId}), user_id=${existingUserId}, fields: ${fieldNames.join(', ')}`);
        return;
      }

      // Check if employee exists by email (no emp_no match)
      const existingByEmail = empByEmail.get(email);
      if (existingByEmail) {
        const existingDeptId = toInt(existingByEmail.department_id);
        if (!isNaN(existingDeptId) && existingDeptId !== departmentId) {
          result.errors.push({ row: rowNum, message: `Email ${email} already belongs to an employee in another department` });
          result.failed++;
          return;
        }

        if (!existingByEmail.emp_no) {
          // Employee exists without emp_no — patch it only within the same department.
          const patch: Partial<Employee> = { emp_no: empNo };
          const linkedUser = userByEmail.get(email);
          const linkedUserId = optionalInt(existingByEmail.user_id) ?? optionalInt(linkedUser?.id);
          if (!optionalInt(existingByEmail.user_id) && linkedUserId) {
            patch.user_id = linkedUserId;
          }
          if (placeId !== undefined) patch.place_id = placeId;
          if (lat !== undefined) patch.lat = lat;
          if (lng !== undefined) patch.lng = lng;

          const existingId = requireInt(existingByEmail.id, 'existingByEmail.id');
          await queryRunner.manager.update(Employee, existingId, patch);
          Object.assign(existingByEmail, patch);
          empByNo.set(empNo, existingByEmail);

          if (linkedUserId) {
            const userPatch: Partial<User> = {};
            if (!linkedUser || linkedUser.employee_id === null || linkedUser.employee_id === undefined || toInt(linkedUser.employee_id) !== existingId) {
              userPatch.employee_id = existingId;
              this.logger.debug(`Row ${rowNum}: Backfilling users.employee_id=${existingId} for user ${linkedUserId}`);
            }
            if (Object.keys(userPatch).length > 0) {
              await queryRunner.manager.update(User, linkedUserId, userPatch);
            }
          }

          result.updated++;
          result.updates.push({ row: rowNum, empNo, fields: Object.keys(patch) });
          this.logger.debug(`Row ${rowNum}: Linked emp_no ${empNo} to existing email employee (id=${existingId})`);
        } else {
          result.errors.push({ row: rowNum, message: `Email ${email} already belongs to employee ${existingByEmail.emp_no}` });
          result.failed++;
        }
        return;
      }

      // === CREATE new employee ===
      this.logger.debug(`Row ${rowNum}: Creating new employee ${empNo}`);

      // Find or create user account
      let existingUser = userByEmail.get(email);
      if (!existingUser) {
        // Double-check DB (case-insensitive)
        existingUser = await queryRunner.manager
          .createQueryBuilder(User, 'u')
          .where('LOWER(u.email) = LOWER(:email)', { email })
          .getOne() ?? undefined;
      }

      let userRecord: User;
      if (existingUser) {
        const userDeptId = toInt(existingUser.department_id);
        if (!isNaN(userDeptId) && userDeptId !== departmentId) {
          result.errors.push({ row: rowNum, message: `User account ${email} belongs to another department and cannot be reassigned by this upload` });
          result.failed++;
          return;
        }
        if (existingUser.employee_id) {
          result.errors.push({ row: rowNum, message: `User account ${email} is already linked to another employee` });
          result.failed++;
          return;
        }
        userRecord = existingUser;
      } else {
        // Use pre-computed hash (or fallback)
        const hash = passwordHashes.get(email) || await bcrypt.hash(empNo, 10);
        userRecord = await queryRunner.manager.save(User, queryRunner.manager.create(User, {
          full_name: fullName,
          email,
          phone,
          password_hash: hash,
          role: AppRole.EMP,
          department_id: departmentId,
          status: AccountStatus.ACTIVE,
        }));
        this.logger.debug(`Row ${rowNum}: Created user account id=${userRecord.id}`);
      }

      const userId = requireInt(userRecord.id, 'userRecord.id');

      // Create employee record
      const newEmp = await queryRunner.manager.save(Employee, queryRunner.manager.create(Employee, {
        full_name: fullName,
        email,
        phone,
        emp_no: empNo,
        department_id: departmentId,
        user_id: userId,
        place_id: placeId,
        lat,
        lng,
        status: AccountStatus.ACTIVE,
        is_active: true,
      }));

      const newEmpId = requireInt(newEmp.id, 'newEmp.id');

      // Link user → employee (bidirectional)
      await queryRunner.manager.update(User, userId, { employee_id: newEmpId });
      userRecord.employee_id = newEmpId;

      // Update caches
      empByNo.set(empNo, newEmp);
      empByEmail.set(email, newEmp);
      userByEmail.set(email, userRecord);

      result.created++;
      this.logger.log(`Row ${rowNum}: Created employee ${empNo} (id=${newEmpId}), user_id=${userId}, users.employee_id=${newEmpId}, place_id=${placeId ?? 'NULL'}, dept=${departmentId}`);
    } catch (err: any) {
      this.logger.error(`Row ${rowNum}: Error processing emp_no=${empNo}: ${err.message}`, err.stack);
      // Re-throw so the savepoint wrapper handles rollback and error recording
      throw err;
    }
  }

  private async resolvePlace(
    title: string,
    lat: number | undefined,
    lng: number | undefined,
    placeByTitle: Map<string, Place>,
    queryRunner: any,
  ): Promise<PlaceResolutionResult> {
    const normalizedTitle = this.normalizePlaceTitle(title);
    if (!normalizedTitle) {
      return {
        cacheMatch: false,
        dbMatch: false,
        createAttempted: false,
        failureReason: 'location_name is empty after normalization',
      };
    }

    const existing = placeByTitle.get(normalizedTitle);

    if (existing) {
      this.logger.debug(`resolvePlace: Matched existing place "${title}" → id=${existing.id}`);
      return {
        placeId: requireInt(existing.id, 'place.id'),
        cacheMatch: true,
        dbMatch: false,
        createAttempted: false,
      };
    }

    const dbPlace = await queryRunner.manager
      .createQueryBuilder(Place, 'p')
      .where("LOWER(REGEXP_REPLACE(TRIM(p.title), '\\s+', ' ', 'g')) = :normalizedTitle", { normalizedTitle })
      .andWhere('p.is_active = true')
      .getOne();
    if (dbPlace) {
      this.logger.debug(`resolvePlace: DB match for "${title}" → id=${dbPlace.id}`);
      placeByTitle.set(normalizedTitle, dbPlace);
      return {
        placeId: requireInt(dbPlace.id, 'dbPlace.id'),
        cacheMatch: false,
        dbMatch: true,
        createAttempted: false,
      };
    }

    if ((lat === undefined) !== (lng === undefined)) {
      return {
        cacheMatch: false,
        dbMatch: false,
        createAttempted: false,
        failureReason: 'latitude and longitude must both be provided when creating a new place',
      };
    }

    if (lat === undefined || lng === undefined) {
      this.logger.warn(`resolvePlace: "${title}" not found and no coordinates — cannot create place`);
      return {
        cacheMatch: false,
        dbMatch: false,
        createAttempted: false,
        failureReason: 'place not found. Upload the place first or provide both latitude and longitude to create it automatically',
      };
    }

    const cleanTitle = title.trim().replace(/\s+/g, ' ');
    const newPlace = await queryRunner.manager.save(Place, queryRunner.manager.create(Place, {
      title: cleanTitle,
      latitude: lat,
      longitude: lng,
      is_active: true,
    }));
    placeByTitle.set(normalizedTitle, newPlace);
    this.logger.debug(`resolvePlace: Created new place "${cleanTitle}" → id=${newPlace.id}`);
    return {
      placeId: requireInt(newPlace.id, 'newPlace.id'),
      cacheMatch: false,
      dbMatch: false,
      createAttempted: true,
    };
  }

  private logFirstPlaceFailure(
    failureDebugState: FailureDebugState,
    details: {
      rowNum: number;
      empNo: string;
      locationName: string;
      lat?: number;
      lng?: number;
      cacheMatch: boolean;
      dbMatch: boolean;
      createAttempted: boolean;
      finalReason: string;
    },
  ) {
    if (failureDebugState.logged) return;
    failureDebugState.logged = true;
    this.logger.error(
      `Bulk upload first failing row debug: row=${details.rowNum}, empNo=${details.empNo}, location_name="${details.locationName}", latitude=${details.lat ?? ''}, longitude=${details.lng ?? ''}, cacheMatch=${details.cacheMatch}, dbMatch=${details.dbMatch}, createAttempted=${details.createAttempted}, finalReason=${details.finalReason}`,
    );
  }

  private normalizeRowKeys(row: Record<string, any>): Record<string, any> {
    const normalized: Record<string, any> = {};
    for (const [key, value] of Object.entries(row ?? {})) {
      normalized[this.normalizeHeaderKey(key)] = value;
    }
    return normalized;
  }

  private normalizeHeaderKey(key: string): string {
    return String(key ?? '').trim().toLowerCase()
      .replace(/\r?\n/g, ' ')
      .replace(/[()]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private getRowValue(row: Record<string, any>, aliases: string[]): any {
    for (const alias of aliases) {
      const value = row[this.normalizeHeaderKey(alias)];
      if (value !== undefined) return value;
    }
    return undefined;
  }

  private getRowString(row: Record<string, any>, aliases: string[]): string {
    const value = this.getRowValue(row, aliases);
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') {
      return Number.isInteger(value) ? value.toString() : String(value);
    }
    return String(value).trim();
  }

  private normalizePlaceTitle(value: string): string {
    return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private hasValue(value: any): boolean {
    return value !== undefined && value !== null && String(value).trim() !== '';
  }

  private isFatalSystemError(err: any): boolean {
    const message = String(err?.message ?? '').toLowerCase();
    return [
      'connection terminated',
      'connection is not established',
      'connection is closed',
      'driver not connected',
      'query runner already released',
      'econnreset',
      'econnrefused',
      'etimedout',
      'timeout acquiring a connection',
      'unable to connect',
    ].some((token) => message.includes(token));
  }
}
