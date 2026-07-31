import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { RequirePermissions } from '@/shared/auth/permissions';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { AttendanceDto } from '@/shared/http/common.dto';
import { AttendanceService } from './attendance.service';

@ApiTags('attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get()
  @RequirePermissions('attendance.read')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.attendance.list(user.studioId);
  }

  @Post('mark')
  @RequirePermissions('attendance.manage')
  mark(@CurrentUser() user: AuthenticatedUser, @Body() dto: AttendanceDto) {
    return this.attendance.mark({
      studioId: user.studioId,
      actorStaffId: user.staffMemberId,
      classBookingId: dto.classBookingId,
      status: dto.status,
      justification: dto.justification,
    });
  }
}
