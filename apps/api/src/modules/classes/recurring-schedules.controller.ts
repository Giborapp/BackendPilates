import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { RequireAnyPermission, RequirePermissions } from '@/shared/auth/permissions';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import {
  CreateRecurringEnrollmentDto,
  CreateScheduleDto,
  GenerateSessionsDto,
  IdParamDto,
  PauseScheduleDto,
  UpdateScheduleDto,
} from '@/shared/http/common.dto';
import { RecurringSchedulesService } from './recurring-schedules.service';

@ApiTags('recurring-schedules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('recurring-schedules')
export class RecurringSchedulesController {
  constructor(private readonly recurringSchedules: RecurringSchedulesService) {}

  @Get()
  @RequireAnyPermission('classes.read_own', 'classes.read_all')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.recurringSchedules.list(user);
  }

  @Post()
  @RequirePermissions('classes.create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateScheduleDto) {
    return this.recurringSchedules.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions('classes.update')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.recurringSchedules.update(user, params.id, dto);
  }

  @Post(':id/pause')
  @RequirePermissions('classes.update')
  pause(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() dto: PauseScheduleDto,
  ) {
    return this.recurringSchedules.pause(user, params.id, dto.weeks);
  }

  @Post(':id/archive')
  @RequirePermissions('classes.cancel')
  archive(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    return this.recurringSchedules.archive(user, params.id);
  }

  @Post(':id/enrollments')
  @RequirePermissions('classes.update')
  enroll(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() dto: CreateRecurringEnrollmentDto,
  ) {
    return this.recurringSchedules.enroll(user, params.id, dto.studentId);
  }

  @Post(':id/generate-sessions')
  @RequirePermissions('classes.create')
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() dto: GenerateSessionsDto,
  ) {
    return this.recurringSchedules.generate(user, params.id, new Date(dto.from), new Date(dto.to));
  }
}
