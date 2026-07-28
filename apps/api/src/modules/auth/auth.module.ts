import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { DeviceAuthGuard } from '@/shared/auth/device-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { AppConfigService } from '@/shared/config/app-config.service';
import { AuditModule } from '../audit/audit.module';

@Global()
@Module({
  imports: [JwtModule.register({}), AuditModule],
  providers: [AppConfigService, AuthService, JwtAuthGuard, DeviceAuthGuard, PermissionsGuard],
  controllers: [AuthController],
  exports: [AppConfigService, AuthService, JwtAuthGuard, DeviceAuthGuard, PermissionsGuard, JwtModule],
})
export class AuthModule {}
