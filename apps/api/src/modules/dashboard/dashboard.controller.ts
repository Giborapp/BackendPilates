import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { RequirePermissions } from '@/shared/auth/permissions';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { AttendanceService, withLessonBalance } from '../attendance/attendance.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendance: AttendanceService,
  ) {}

  @Get()
  @RequirePermissions('dashboard.read')
  async get(@CurrentUser() user: AuthenticatedUser) {
    await this.attendance.markAutomaticNoShows(user.studioId);
    const now = new Date();
    const startOfDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const endOfDay = new Date(startOfDay.getTime() + 86_400_000);
    const classWhere = user.permissions.includes('classes.read_all')
      ? { studioId: user.studioId, startsAt: { gte: startOfDay, lt: endOfDay } }
      : {
          studioId: user.studioId,
          professionalId: user.staffMemberId,
          startsAt: { gte: startOfDay, lt: endOfDay },
        };
    const [classes, overduePayments, duePayments, trials, credits] = await Promise.all([
      this.prisma.classSession.findMany({
        where: classWhere,
        include: { bookings: { include: { student: true, attendance: true } } },
        orderBy: { startsAt: 'asc' },
      }),
      user.permissions.includes('payments.read')
        ? this.prisma.payment.findMany({
            where: {
              studioId: user.studioId,
              status: PaymentStatus.PENDING,
              dueDate: { lt: startOfDay },
            },
            include: { student: true },
            take: 20,
          })
        : Promise.resolve([]),
      user.permissions.includes('payments.read')
        ? this.prisma.payment.findMany({
            where: {
              studioId: user.studioId,
              status: PaymentStatus.PENDING,
              dueDate: { gte: startOfDay, lt: new Date(startOfDay.getTime() + 7 * 86_400_000) },
            },
            include: { student: true },
            take: 20,
          })
        : Promise.resolve([]),
      this.prisma.trialProcess.findMany({
        where: { studioId: user.studioId, scheduledSessionId: { not: null } },
        include: { student: true },
        take: 20,
      }),
      this.prisma.replacementCredit.findMany({
        where: {
          studioId: user.studioId,
          status: 'AVAILABLE',
          expiresAt: { lt: new Date(now.getTime() + 7 * 86_400_000) },
        },
        include: { student: true },
        take: 20,
      }),
    ]);
    const studentIds = [
      ...new Set(
        classes.flatMap((classSession) =>
          classSession.bookings.map((booking) => booking.student.id),
        ),
      ),
    ];
    const usage = await this.attendance.studentMonthlyUsage(user.studioId, studentIds);
    const classesWithBalance = classes.map((classSession) => ({
      ...classSession,
      bookings: classSession.bookings.map((booking) => ({
        ...booking,
        student: withLessonBalance(booking.student, usage.get(booking.student.id) ?? 0),
      })),
    }));
    return {
      classesToday: classesWithBalance,
      overduePayments,
      duePayments,
      trialProcesses: trials,
      expiringCredits: credits,
    };
  }
}
