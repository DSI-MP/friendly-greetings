import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Roles, CurrentUser } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { AppRole, RequestStatus } from '../../common/enums';
import { TransportRequest } from '../transport-requests/transport-request.entity';
import { Employee } from '../employees/employee.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Driver } from '../drivers/driver.entity';
import { Department } from '../departments/department.entity';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(
    @InjectRepository(TransportRequest) private reqRepo: Repository<TransportRequest>,
    @InjectRepository(Employee) private empRepo: Repository<Employee>,
    @InjectRepository(Vehicle) private vehRepo: Repository<Vehicle>,
    @InjectRepository(Driver) private driverRepo: Repository<Driver>,
    @InjectRepository(Department) private deptRepo: Repository<Department>,
  ) {}

  @Get('admin')
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN)
  async adminDashboard() {
    const [totalRequests, pendingRequests, totalEmployees, totalVehicles, totalDrivers, totalDepartments] =
      await Promise.all([
        this.reqRepo.count(),
        this.reqRepo.count({ where: { status: RequestStatus.SUBMITTED } }),
        this.empRepo.count(),
        this.vehRepo.count({ where: { is_active: true } }),
        this.driverRepo.count({ where: { is_active: true } }),
        this.deptRepo.count({ where: { is_active: true } }),
      ]);
    return { totalRequests, pendingRequests, totalEmployees, totalVehicles, totalDrivers, totalDepartments };
  }

  @Get('hod')
  @Roles(AppRole.HOD)
  async hodDashboard(@CurrentUser() user: any) {
    const [deptRequests, deptEmployees] = await Promise.all([
      this.reqRepo.count({ where: { department_id: user.departmentId } }),
      this.empRepo.count({ where: { department_id: user.departmentId } }),
    ]);
    return { deptRequests, deptEmployees, departmentId: user.departmentId };
  }

  @Get('hr')
  @Roles(AppRole.HR)
  async hrDashboard() {
    const pendingHR = await this.reqRepo.count({ where: { status: RequestStatus.TA_COMPLETED } });
    const approved = await this.reqRepo.count({ where: { status: RequestStatus.HR_APPROVED } });
    return { pendingHR, approved };
  }

  @Get('ta')
  @Roles(AppRole.TRANSPORT_AUTHORITY)
  async taDashboard() {
    const pendingGrouping = await this.reqRepo.count({ where: { status: RequestStatus.DAILY_LOCKED } });
    const processing = await this.reqRepo.count({ where: { status: RequestStatus.TA_PROCESSING } });
    return { pendingGrouping, processing };
  }

  @Get('planning')
  @Roles(AppRole.PLANNING)
  async planningDashboard() {
    const totalVehicles = await this.vehRepo.count({ where: { is_active: true } });
    const totalDrivers = await this.driverRepo.count({ where: { is_active: true } });
    return { totalVehicles, totalDrivers };
  }
}
