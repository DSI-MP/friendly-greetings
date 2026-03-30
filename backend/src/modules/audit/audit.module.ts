import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditLog, AuthEvent, PasswordResetRequest, TwoFactorSetting } from './audit.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, AuthEvent, PasswordResetRequest, TwoFactorSetting])],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
