import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigService } from './shared/config/app-config.service';
import { validateEnv } from './shared/config/env.validation';
import { PrismaModule } from './shared/prisma/prisma.module';
import { HttpExceptionFilter } from './shared/http/http-exception.filter';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuditModule } from './modules/audit/audit.module';
import { StaffModule } from './modules/staff/staff.module';
import { StudentsModule } from './modules/students/students.module';
import { StudiosModule } from './modules/studios/studios.module';
import { StudioSettingsModule } from './modules/studio-settings/studio-settings.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { DevicesModule } from './modules/devices/devices.module';
import { UnitsModule } from './modules/units/units.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { PlansModule } from './modules/plans/plans.module';
import { StudentPlansModule } from './modules/student-plans/student-plans.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ClassesModule } from './modules/classes/classes.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { ReplacementCreditsModule } from './modules/replacement-credits/replacement-credits.module';
import { AssessmentsModule } from './modules/assessments/assessments.module';
import { FilesModule } from './modules/files/files.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SetupModule } from './modules/setup/setup.module';
import { PublicIntakesModule } from './modules/public-intakes/public-intakes.module';
import { ReplacementLinksModule } from './modules/replacement-links/replacement-links.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule.forRoot({
      pinoHttp: {
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.url',
            'req.body.password',
            'req.body.pin',
            'req.body.refreshToken',
          ],
          censor: '[redacted]',
        },
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuditModule,
    HealthModule,
    AuthModule,
    StudiosModule,
    StudioSettingsModule,
    StaffModule,
    PermissionsModule,
    DevicesModule,
    UnitsModule,
    RoomsModule,
    StudentsModule,
    PlansModule,
    StudentPlansModule,
    PaymentsModule,
    ClassesModule,
    AttendanceModule,
    ReplacementCreditsModule,
    AssessmentsModule,
    FilesModule,
    DashboardModule,
    SetupModule,
    PublicIntakesModule,
    ReplacementLinksModule,
  ],
  providers: [
    AppConfigService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
