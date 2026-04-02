import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Employee } from './employee.entity';
import { User } from '../users/user.entity';
import { Place } from '../places/place.entity';
import { Department } from '../departments/department.entity';
import { SelfRegisterDto, CreateEmployeeDto } from './dto/employee.dto';
import { PaginationDto, PaginatedResult } from '../../common/dto';
import { AppRole, AccountStatus, SelfRegRole } from '../../common/enums';

interface UserContext {
  id?: number;
  sub?: number;
  role: AppRole;
  departmentId?: number;
}

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee) private empRepo: Repository<Employee>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Place) private placeRepo: Repository<Place>,
    @InjectRepository(Department) private deptRepo: Repository<Department>,
  ) {}

  async findAll(query: PaginationDto, departmentId?: number): Promise<PaginatedResult<Employee>> {
    const { page = 1, limit = 20, search, sortBy = 'created_at', sortOrder = 'DESC' } = query;
    const where: any = {};
    if (search) where.full_name = Like(`%${search}%`);
    if (departmentId) where.department_id = Number(departmentId);

    const [items, total] = await this.empRepo.findAndCount({
      where,
      order: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async create(dto: CreateEmployeeDto): Promise<Employee> {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const existingUser = await this.userRepo.findOne({ where: { email: dto.email.toLowerCase().trim() } });
    if (existingUser) throw new ConflictException('Email already registered');

    if (dto.empNo) {
      const existing = await this.empRepo.findOne({ where: { emp_no: dto.empNo } });
      if (existing) throw new ConflictException('Employee number already exists');
    }

    const hash = await bcrypt.hash(dto.password, 12);

    // Create user account
    const user = await this.userRepo.save(this.userRepo.create({
      full_name: dto.fullName.trim(),
      email: dto.email.toLowerCase().trim(),
      phone: dto.phone,
      password_hash: hash,
      role: AppRole.EMP,
      department_id: Number(dto.departmentId),
      status: AccountStatus.ACTIVE,
    }));

    // Create employee record
    const employee = await this.empRepo.save(this.empRepo.create({
      full_name: dto.fullName.trim(),
      email: dto.email.toLowerCase().trim(),
      phone: dto.phone,
      emp_no: dto.empNo,
      department_id: Number(dto.departmentId),
      place_id: dto.placeId ? Number(dto.placeId) : undefined,
      lat: dto.lat,
      lng: dto.lng,
      user_id: Number(user.id),
      status: AccountStatus.ACTIVE,
    }));

    // Backfill users.employee_id
    await this.userRepo.update(user.id, { employee_id: Number(employee.id) });

    return employee;
  }

  async update(id: number, data: Partial<Employee>, user?: UserContext): Promise<Employee> {
    const emp = await this.empRepo.findOne({ where: { id } });
    if (!emp) throw new NotFoundException('Employee not found');

    // HOD can only update employees in their own department
    if (user && user.role === AppRole.HOD) {
      const userDeptId = Number(user.departmentId);
      if (!userDeptId || emp.department_id !== userDeptId) {
        throw new ForbiddenException('You can only update employees in your own department.');
      }
    }

    // emp_no is immutable after creation
    delete (data as any).emp_no;

    await this.empRepo.update(id, data);
    const updated = await this.empRepo.findOne({ where: { id } });
    if (!updated) throw new NotFoundException('Employee not found after update');

    if (updated.user_id) {
      await this.userRepo.update(updated.user_id, {
        full_name: updated.full_name,
        email: updated.email,
        phone: updated.phone,
        department_id: Number(updated.department_id),
        employee_id: Number(updated.id),
      });
    }

    return updated;
  }

  async selfRegister(dto: SelfRegisterDto): Promise<{ message: string }> {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const existingUser = await this.userRepo.findOne({ where: { email: dto.email.toLowerCase().trim() } });
    if (existingUser) throw new ConflictException('Email already registered');

    if (!dto.empNo || !dto.empNo.trim()) {
      throw new BadRequestException('Employee number is required');
    }
    const existingEmp = await this.empRepo.findOne({ where: { emp_no: dto.empNo.trim() } });
    if (existingEmp) throw new ConflictException('Employee number already exists');

    const hash = await bcrypt.hash(dto.password, 12);
    const role = dto.registerAs === SelfRegRole.HOD ? AppRole.HOD : AppRole.EMP;

    // Create user with pending status
    const user = await this.userRepo.save(this.userRepo.create({
      full_name: dto.fullName.trim(),
      email: dto.email.toLowerCase().trim(),
      phone: dto.phone.trim(),
      password_hash: hash,
      role,
      department_id: Number(dto.departmentId),
      status: AccountStatus.PENDING_APPROVAL,
    }));

    // Create employee record
    const employee = await this.empRepo.save(this.empRepo.create({
      full_name: dto.fullName.trim(),
      email: dto.email.toLowerCase().trim(),
      phone: dto.phone.trim(),
      emp_no: dto.empNo.trim(),
      department_id: Number(dto.departmentId),
      place_id: dto.placeId ? Number(dto.placeId) : undefined,
      user_id: Number(user.id),
      register_as: dto.registerAs,
      status: AccountStatus.PENDING_APPROVAL,
    }));

    // Backfill users.employee_id
    await this.userRepo.update(user.id, { employee_id: Number(employee.id) });

    const approverMsg = dto.registerAs === SelfRegRole.HOD
      ? 'Your request will be sent to Admin / Super Admin for approval.'
      : 'Your request will be sent to the department HOD for approval.';

    return { message: `Registration submitted. ${approverMsg}` };
  }

  async getPendingSelfRegistrations(departmentId?: number): Promise<Employee[]> {
    const where: any = { status: AccountStatus.PENDING_APPROVAL };
    if (departmentId) where.department_id = departmentId;
    return this.empRepo.find({ where, order: { created_at: 'DESC' } });
  }

  async approveSelfRegistration(id: number): Promise<{ message: string }> {
    const emp = await this.empRepo.findOne({ where: { id } });
    if (!emp) throw new NotFoundException('Employee not found');
    if (emp.status !== AccountStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Employee is not pending approval');
    }

    await this.empRepo.update(id, { status: AccountStatus.ACTIVE, is_active: true });
    if (emp.user_id) {
      await this.userRepo.update(emp.user_id, { status: AccountStatus.ACTIVE });
    }
    return { message: 'Registration approved' };
  }

  async rejectSelfRegistration(id: number): Promise<{ message: string }> {
    const emp = await this.empRepo.findOne({ where: { id } });
    if (!emp) throw new NotFoundException('Employee not found');
    await this.empRepo.update(id, { status: AccountStatus.INACTIVE, is_active: false });
    if (emp.user_id) {
      await this.userRepo.update(emp.user_id, { status: AccountStatus.INACTIVE });
    }
    return { message: 'Registration rejected' };
  }

  async getEmployeesForExport(departmentIds: number[]): Promise<any[]> {
    const employees = await this.empRepo.find({
      where: { department_id: In(departmentIds), is_active: true },
      order: { department_id: 'ASC', full_name: 'ASC' },
    });

    // Load departments and places for name resolution
    const deptIds = [...new Set(employees.map(e => e.department_id))];
    const placeIds = [...new Set(employees.filter(e => e.place_id).map(e => e.place_id!))];

    const departments = deptIds.length > 0 ? await this.deptRepo.find({ where: { id: In(deptIds) } }) : [];
    const places = placeIds.length > 0 ? await this.placeRepo.find({ where: { id: In(placeIds) } }) : [];

    const deptMap = new Map(departments.map(d => [d.id, d.name]));
    const placeMap = new Map(places.map(p => [p.id, p.title]));

    return employees.map(e => ({
      'Employee ID': e.emp_no || '',
      'Full Name': e.full_name,
      'Email': e.email,
      'Phone': e.phone || '',
      'Department': deptMap.get(e.department_id) || String(e.department_id),
      'Drop-off Location': e.place_id ? (placeMap.get(e.place_id) || '') : '',
      'Status': e.status,
    }));
  }
}
