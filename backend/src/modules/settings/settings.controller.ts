import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting, HolidayCalendar } from './settings.entity';
import { Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { AppRole } from '../../common/enums';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('settings')
export class SettingsController {
  constructor(
    @InjectRepository(SystemSetting) private settingsRepo: Repository<SystemSetting>,
  ) {}

  @Get()
  @Roles(AppRole.ADMIN, AppRole.SUPER_ADMIN, AppRole.TRANSPORT_AUTHORITY)
  async getAll() {
    // Auto-create cost_per_km if missing
    const existing = await this.settingsRepo.findOne({ where: { key: 'cost_per_km' } });
    if (!existing) {
      await this.settingsRepo.save({
        key: 'cost_per_km',
        value: '50',
        category: 'Cost',
        description: 'Cost per kilometre (LKR) used for transport cost estimates',
      });
    }
    return this.settingsRepo.find({ order: { category: 'ASC', key: 'ASC' } });
  }

  @Patch()
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN, AppRole.TRANSPORT_AUTHORITY)
  async updateSettings(@Body() settings: { key: string; value: string }[]) {
    for (const s of settings) {
      await this.settingsRepo.upsert({ key: s.key, value: s.value, updated_at: new Date() }, ['key']);
    }
    return { message: 'Settings updated' };
  }
}
