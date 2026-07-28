import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AttendanceStatus } from '@prisma/client';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { RequirePermissions } from '@/shared/auth/permissions';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { AttendanceDto } from '@/shared/http/common.dto';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@ApiTags('attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions('attendance.read')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.prisma.attendance.findMany({ where: { studioId: user.studioId }, include: { classBooking: true } });
  }

  @Post('mark')
  @RequirePermissions('attendance.manage')
  async mark(@CurrentUser() user: AuthenticatedUser, @Body() dto: AttendanceDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.classBooking.findFirstOrThrow({
        where: { id: dto.classBookingId, studioId: user.studioId },
        include: { classSession: true },
      });
      const attendance = await tx.attendance.upsert({
        where: { classBookingId: booking.id },
        create: { studioId: user.studioId, classBookingId: booking.id, status: dto.status, justification: dto.justification, markedByStaffId: user.staffMemberId },
        update: { status: dto.status, justification: dto.justification, markedByStaffId: user.staffMemberId, markedAt: new Date() },
      });
      if (
        dto.status === AttendanceStatus.JUSTIFIED_ABSENCE ||
        dto.status === AttendanceStatus.CANCELLED_IN_TIME
      ) {
        const settings = await tx.studioSettings.findUniqueOrThrow({ where: { studioId: user.studioId } });
        const expiresAt = new Date(Date.now() + settings.replacementCreditValidityDays * 86_400_000);
        await tx.replacementCredit.upsert({
          where: { sourceAttendanceId: attendance.id },
          create: { studioId: user.studioId, studentId: booking.studentId, sourceAttendanceId: attendance.id, expiresAt, notes: dto.justification },
          update: {},
        });
      }
      return attendance;
    });
    await this.audit.record({ studioId: user.studioId, actorStaffId: user.staffMemberId, action: 'attendance.mark', entityType: 'Attendance', entityId: result.id, after: result });
    return result;
  }
}
