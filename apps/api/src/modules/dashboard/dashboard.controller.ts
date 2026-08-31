import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { RequirePermissions } from '@/shared/auth/permissions';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { startOfLocalDay } from '@/shared/domain/local-time';
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
    const studio = await this.prisma.studio.findUniqueOrThrow({
      where: { id: user.studioId },
      select: { timezone: true },
    });
    const startOfDay = startOfLocalDay(now, studio.timezone);
    const endOfDay = new Date(startOfDay.getTime() + 86_400_000);
    const nextSevenDays = new Date(startOfDay.getTime() + 7 * 86_400_000);
    const nextThirtyDays = new Date(startOfDay.getTime() + 30 * 86_400_000);
    const classWhere = user.permissions.includes('classes.read_all')
      ? { studioId: user.studioId, startsAt: { gte: startOfDay, lt: endOfDay } }
      : {
          studioId: user.studioId,
          professionalId: user.staffMemberId,
          startsAt: { gte: startOfDay, lt: endOfDay },
        };
    const classScope = user.permissions.includes('classes.read_all')
      ? { studioId: user.studioId }
      : { studioId: user.studioId, professionalId: user.staffMemberId };
    const [classes, overduePayments, duePayments, trials, credits, availableCredits, pendingIntakes, pendingAssessments, upcomingClasses] = await Promise.all([
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
          expiresAt: { lt: nextThirtyDays },
        },
        include: { student: true },
        take: 20,
      }),
      this.prisma.replacementCredit.count({
        where: { studioId: user.studioId, status: 'AVAILABLE', expiresAt: { gte: now } },
      }),
      this.prisma.publicIntakeRequest.findMany({
        where: { studioId: user.studioId, status: 'PENDING' },
        select: { id: true, createdAt: true, invite: { select: { type: true } } },
        orderBy: { createdAt: 'asc' },
        take: 20,
      }),
      user.permissions.includes('assessments.clinical_read')
        ? this.prisma.assessment.count({ where: { studioId: user.studioId, status: 'DRAFT' } })
        : Promise.resolve(0),
      this.prisma.classSession.findMany({
        where: { ...classScope, startsAt: { gte: startOfDay, lt: nextSevenDays }, status: 'SCHEDULED' },
        select: { id: true, capacity: true, bookings: { where: { status: 'BOOKED' }, select: { id: true } } },
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
      pendingIntakes,
      dashboardCounts: {
        classesToday: classes.length,
        pendingAttendances: classes.reduce((total, session) => total + session.bookings.filter((booking) => !booking.attendance).length, 0),
        overduePayments: overduePayments.length,
        duePayments: duePayments.length,
        pendingIntakes: pendingIntakes.length,
        pendingAssessments,
        availableCredits,
        expiringCredits30: credits.filter((credit) => credit.expiresAt <= nextThirtyDays).length,
        expiringCredits7: credits.filter((credit) => credit.expiresAt <= nextSevenDays).length,
        nearCapacity: upcomingClasses.filter((session) => session.bookings.length >= Math.max(0, session.capacity - 1)).length,
      },
    };
  }
}
