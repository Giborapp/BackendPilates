import { Injectable } from '@nestjs/common';
import { AttendanceStatus } from '@prisma/client';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const CONSUMING_ATTENDANCE_STATUSES: AttendanceStatus[] = [
  AttendanceStatus.PRESENT,
  AttendanceStatus.ABSENT,
  AttendanceStatus.CANCELLED_LATE,
];

type MarkAttendanceInput = {
  studioId: string;
  actorStaffId?: string;
  classBookingId: string;
  status: AttendanceStatus;
  justification?: string;
};

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(studioId: string) {
    return this.prisma.attendance.findMany({
      where: { studioId },
      include: { classBooking: { include: { student: true, classSession: true } } },
      orderBy: { markedAt: 'desc' },
    });
  }

  async mark(input: MarkAttendanceInput) {
    const result = await this.prisma.$transaction(async (tx) => {
      const booking = await tx.classBooking.findFirstOrThrow({
        where: { id: input.classBookingId, studioId: input.studioId },
        include: { classSession: true },
      });
      const attendance = await tx.attendance.upsert({
        where: { classBookingId: booking.id },
        create: {
          studioId: input.studioId,
          classBookingId: booking.id,
          status: input.status,
          justification: input.justification,
          markedByStaffId: input.actorStaffId,
        },
        update: {
          status: input.status,
          justification: input.justification,
          markedByStaffId: input.actorStaffId,
          markedAt: new Date(),
        },
      });
      if (
        input.status === AttendanceStatus.JUSTIFIED_ABSENCE ||
        input.status === AttendanceStatus.CANCELLED_IN_TIME
      ) {
        const settings = await tx.studioSettings.findUniqueOrThrow({
          where: { studioId: input.studioId },
        });
        const expiresAt = new Date(
          Date.now() + settings.replacementCreditValidityDays * 86_400_000,
        );
        await tx.replacementCredit.upsert({
          where: { sourceAttendanceId: attendance.id },
          create: {
            studioId: input.studioId,
            studentId: booking.studentId,
            sourceAttendanceId: attendance.id,
            expiresAt,
            notes: input.justification,
          },
          update: { notes: input.justification },
        });
      }
      return attendance;
    });
    await this.audit.record({
      studioId: input.studioId,
      actorStaffId: input.actorStaffId,
      action: 'attendance.mark',
      entityType: 'Attendance',
      entityId: result.id,
      after: result,
    });
    return result;
  }

  async markAutomaticNoShows(studioId: string, now = new Date()): Promise<number> {
    const threshold = new Date(now.getTime() - 3 * 60 * 60_000);
    const bookings = await this.prisma.classBooking.findMany({
      where: {
        studioId,
        status: 'BOOKED',
        attendance: null,
        classSession: {
          studioId,
          status: { not: 'CANCELLED' },
          startsAt: { lte: threshold },
        },
      },
      select: { id: true },
      take: 200,
    });
    if (bookings.length === 0) {
      return 0;
    }
    await this.prisma.attendance.createMany({
      data: bookings.map((booking) => ({
        studioId,
        classBookingId: booking.id,
        status: AttendanceStatus.ABSENT,
        justification: 'Automatic no-show after 3 hours',
      })),
      skipDuplicates: true,
    });
    await this.audit.record({
      studioId,
      action: 'attendance.auto_no_show',
      entityType: 'Attendance',
      metadata: { count: bookings.length },
    });
    return bookings.length;
  }

  async studentMonthlyUsage(studioId: string, studentIds: string[], reference = new Date()) {
    if (studentIds.length === 0) {
      return new Map<string, number>();
    }
    const start = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
    const end = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 1));
    const grouped = await this.prisma.attendance.groupBy({
      by: ['classBookingId'],
      where: {
        studioId,
        status: { in: CONSUMING_ATTENDANCE_STATUSES },
        classBooking: {
          studentId: { in: studentIds },
          classSession: { startsAt: { gte: start, lt: end } },
        },
      },
      _count: { _all: true },
    });
    if (grouped.length === 0) {
      return new Map<string, number>();
    }
    const bookings = await this.prisma.classBooking.findMany({
      where: { id: { in: grouped.map((item) => item.classBookingId) }, studioId },
      select: { id: true, studentId: true },
    });
    const countByBooking = new Map(grouped.map((item) => [item.classBookingId, item._count._all]));
    const usage = new Map<string, number>();
    for (const booking of bookings) {
      usage.set(
        booking.studentId,
        (usage.get(booking.studentId) ?? 0) + (countByBooking.get(booking.id) ?? 0),
      );
    }
    return usage;
  }
}

export function withLessonBalance<T extends { id: string; monthlyLessonLimit: number }>(
  student: T,
  used: number,
): T & { monthlyLessonsUsed: number; monthlyLessonsRemaining: number } {
  return {
    ...student,
    monthlyLessonsUsed: used,
    monthlyLessonsRemaining: Math.max(student.monthlyLessonLimit - used, 0),
  };
}

export function attendanceConsumesLesson(status: AttendanceStatus): boolean {
  return CONSUMING_ATTENDANCE_STATUSES.includes(status);
}
