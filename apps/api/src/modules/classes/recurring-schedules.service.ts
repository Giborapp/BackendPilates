import { BadRequestException, Injectable } from '@nestjs/common';
import { BookingType, Prisma, Weekday } from '@prisma/client';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { CreateScheduleDto, UpdateScheduleDto } from '@/shared/http/common.dto';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BookingsService } from './bookings.service';

const DEFAULT_SCHEDULE_UNIT_NAME = 'Unidade principal';
const DEFAULT_SCHEDULE_ROOM_NAME = 'Sala principal';
const DEFAULT_SCHEDULE_ROOM_CAPACITY = 6;

@Injectable()
export class RecurringSchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly bookings: BookingsService,
  ) {}

  list(user: AuthenticatedUser) {
    const where = user.permissions.includes('classes.read_all')
      ? { studioId: user.studioId, archivedAt: null }
      : { studioId: user.studioId, professionalId: user.staffMemberId, archivedAt: null };
    return this.prisma.recurringClassSchedule.findMany({
      where,
      include: {
        unit: true,
        room: true,
        professional: { select: { id: true, name: true, role: true } },
        enrollments: { where: { active: true }, include: { student: true } },
      },
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    });
  }

  async create(user: AuthenticatedUser, dto: CreateScheduleDto) {
    const { studentIds = [], confirmFrequencyOverride = false, ...scheduleInput } = dto;
    const uniqueStudentIds = [...new Set(studentIds)];
    if (uniqueStudentIds.length > dto.capacity) throw new BadRequestException('Selected students exceed schedule capacity');
    if (uniqueStudentIds.length > 0) {
      const students = await this.prisma.student.findMany({ where: { id: { in: uniqueStudentIds }, studioId: user.studioId, archivedAt: null }, select: { id: true } });
      if (students.length !== uniqueStudentIds.length) throw new BadRequestException('One or more students are invalid');
      await this.assertNoScheduleConflicts(user, scheduleInput, uniqueStudentIds, confirmFrequencyOverride);
    }
    const relations = await this.resolveScheduleRelations(
      user.studioId,
      scheduleInput.unitId,
      scheduleInput.roomId,
      scheduleInput.professionalId,
    );
    const schedule = await this.prisma.recurringClassSchedule.create({
      data: {
        ...scheduleInput,
        unitId: relations.unitId,
        roomId: relations.roomId,
        studioId: user.studioId,
        startsOn: new Date(dto.startsOn),
        endsOn: dto.endsOn ? new Date(dto.endsOn) : undefined,
      },
    });
    await this.audit.record({
      studioId: user.studioId,
      actorStaffId: user.staffMemberId,
      action: 'recurring_schedules.create',
      entityType: 'RecurringClassSchedule',
      entityId: schedule.id,
      after: schedule,
    });
    await this.generate(user, schedule.id, new Date(), new Date(Date.now() + 12 * 7 * 86_400_000));
    for (const studentId of uniqueStudentIds) await this.enroll(user, schedule.id, studentId);
    return schedule;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateScheduleDto) {
    const before = await this.prisma.recurringClassSchedule.findFirstOrThrow({
      where: { id, studioId: user.studioId, archivedAt: null },
    });
    await this.assertScheduleRelations(
      user.studioId,
      dto.unitId ?? before.unitId,
      dto.roomId ?? before.roomId,
      dto.professionalId ?? before.professionalId,
    );
    const after = await this.prisma.recurringClassSchedule.update({
      where: { id: before.id },
      data: {
        ...dto,
        startsOn: dto.startsOn ? new Date(dto.startsOn) : undefined,
        endsOn: dto.endsOn ? new Date(dto.endsOn) : undefined,
      },
    });
    await this.audit.record({
      studioId: user.studioId,
      actorStaffId: user.staffMemberId,
      action: 'recurring_schedules.update',
      entityType: 'RecurringClassSchedule',
      entityId: after.id,
      before,
      after,
    });
    return after;
  }

  async pause(user: AuthenticatedUser, id: string, weeks: number) {
    const timezone = await this.getStudioTimezone(user.studioId);
    const pauseUntil = localDateAfterWeeks(new Date(), weeks, timezone);
    const pausedWindowEnd = startsAtForLocalDate(addUtcDays(pauseUntil, 1), '00:00', timezone);
    const schedule = await this.prisma.recurringClassSchedule.update({
      where: { id, studioId: user.studioId },
      data: { pauseUntil },
    });
    await this.prisma.classSession.updateMany({
      where: {
        studioId: user.studioId,
        recurringScheduleId: schedule.id,
        startsAt: { gte: new Date(), lt: pausedWindowEnd },
        status: 'SCHEDULED',
      },
      data: { status: 'CANCELLED', cancellationReason: `Horario pausado por ${weeks} semana(s)` },
    });
    await this.audit.record({
      studioId: user.studioId,
      actorStaffId: user.staffMemberId,
      action: 'recurring_schedules.pause',
      entityType: 'RecurringClassSchedule',
      entityId: schedule.id,
      metadata: { weeks, pauseUntil: pauseUntil.toISOString() },
    });
    return schedule;
  }

  async archive(user: AuthenticatedUser, id: string) {
    const schedule = await this.prisma.recurringClassSchedule.update({
      where: { id, studioId: user.studioId },
      data: { active: false, archivedAt: new Date() },
    });
    await this.prisma.classSession.updateMany({
      where: {
        studioId: user.studioId,
        recurringScheduleId: schedule.id,
        startsAt: { gte: new Date() },
        status: 'SCHEDULED',
      },
      data: { status: 'CANCELLED', cancellationReason: 'Horario excluido' },
    });
    await this.audit.record({
      studioId: user.studioId,
      actorStaffId: user.staffMemberId,
      action: 'recurring_schedules.archive',
      entityType: 'RecurringClassSchedule',
      entityId: schedule.id,
    });
    return schedule;
  }

  async enroll(user: AuthenticatedUser, scheduleId: string, studentId: string) {
    const schedule = await this.prisma.recurringClassSchedule.findFirstOrThrow({
      where: { id: scheduleId, studioId: user.studioId, archivedAt: null },
    });
    await this.prisma.student.findFirstOrThrow({
      where: { id: studentId, studioId: user.studioId, archivedAt: null },
    });
    await this.assertStudentFrequency(user, scheduleId, studentId, false);
    const enrollment = await this.prisma.recurringEnrollment.upsert({
      where: {
        studioId_recurringScheduleId_studentId: {
          studioId: user.studioId,
          recurringScheduleId: schedule.id,
          studentId,
        },
      },
      create: { studioId: user.studioId, recurringScheduleId: schedule.id, studentId },
      update: { active: true },
    });
    await this.addStudentToFutureSessions(user, schedule.id, studentId);
    await this.audit.record({
      studioId: user.studioId,
      actorStaffId: user.staffMemberId,
      action: 'recurring_enrollments.create',
      entityType: 'RecurringEnrollment',
      entityId: enrollment.id,
      after: enrollment,
    });
    return enrollment;
  }

  private async assertNoScheduleConflicts(user: AuthenticatedUser, input: Pick<CreateScheduleDto, 'professionalId' | 'weekday' | 'startTime' | 'durationMinutes' | 'roomId'>, studentIds: string[], confirmFrequencyOverride: boolean) {
    const schedules = await this.prisma.recurringClassSchedule.findMany({ where: { studioId: user.studioId, weekday: input.weekday, archivedAt: null }, include: { enrollments: { where: { active: true }, select: { studentId: true } } } });
    const conflicts = schedules.filter((schedule) => timeIntervalsOverlap(input.startTime, input.durationMinutes, schedule.startTime, schedule.durationMinutes));
    if (conflicts.some((schedule) => schedule.professionalId === input.professionalId)) throw new BadRequestException('Professional has an overlapping schedule');
    if (input.roomId && conflicts.some((schedule) => schedule.roomId === input.roomId)) throw new BadRequestException('Room has an overlapping schedule');
    const conflictingStudents = new Set(conflicts.flatMap((schedule) => schedule.enrollments.map((enrollment) => enrollment.studentId)).filter((id) => studentIds.includes(id)));
    if (conflictingStudents.size > 0) throw new BadRequestException('One or more students have an overlapping schedule');
    for (const studentId of studentIds) await this.assertStudentFrequency(user, undefined, studentId, confirmFrequencyOverride);
  }

  private async assertStudentFrequency(user: AuthenticatedUser, scheduleId: string | undefined, studentId: string, confirmed: boolean) {
    const plan = await this.prisma.studentPlan.findFirst({ where: { studioId: user.studioId, studentId, status: 'ACTIVE' }, orderBy: { startDate: 'desc' } });
    if (!plan) return;
    const count = await this.prisma.recurringEnrollment.count({ where: { studioId: user.studioId, studentId, active: true, recurringScheduleId: scheduleId ? { not: scheduleId } : undefined } });
    if (count + 1 > plan.sessionsPerWeek && !(confirmed && (user.role === 'ADMIN' || user.permissions.includes('capacity.override')))) throw new BadRequestException('Weekly frequency exceeded; explicit authorized confirmation is required');
  }

  async generate(user: AuthenticatedUser, id: string, from: Date, to: Date) {
    const schedule = await this.prisma.recurringClassSchedule.findFirstOrThrow({
      where: { id, studioId: user.studioId, active: true, archivedAt: null },
      include: { enrollments: { where: { active: true } } },
    });
    const timezone = await this.getStudioTimezone(user.studioId);
    const dates = matchingLocalDates(from, to, schedule.weekday, timezone).filter((day) =>
      isScheduleActiveOn(schedule, day),
    );
    const created = [];
    for (const day of dates) {
      const startsAt = startsAtForLocalDate(day, schedule.startTime, timezone);
      const endsAt = new Date(startsAt.getTime() + schedule.durationMinutes * 60_000);
      const existing = await this.prisma.classSession.findFirst({
        where: { studioId: user.studioId, recurringScheduleId: schedule.id, startsAt },
      });
      const session =
        existing ??
        (await this.prisma.classSession.create({
          data: {
            studioId: user.studioId,
            recurringScheduleId: schedule.id,
            unitId: schedule.unitId,
            roomId: schedule.roomId,
            professionalId: schedule.professionalId,
            startsAt,
            endsAt,
            capacity: schedule.capacity,
          },
        }));
      for (const enrollment of schedule.enrollments) {
        await this.createBookingIfMissing(user, session.id, enrollment.studentId);
      }
      created.push(session);
    }
    return { items: created, count: created.length };
  }

  private async addStudentToFutureSessions(
    user: AuthenticatedUser,
    scheduleId: string,
    studentId: string,
  ) {
    const sessions = await this.prisma.classSession.findMany({
      where: {
        studioId: user.studioId,
        recurringScheduleId: scheduleId,
        startsAt: { gte: new Date() },
        status: 'SCHEDULED',
      },
      select: { id: true },
    });
    for (const session of sessions) {
      await this.createBookingIfMissing(user, session.id, studentId);
    }
  }

  private async createBookingIfMissing(
    user: AuthenticatedUser,
    classSessionId: string,
    studentId: string,
  ) {
    const existing = await this.prisma.classBooking.findFirst({
      where: {
        studioId: user.studioId,
        classSessionId,
        studentId,
        status: { not: 'CANCELLED' },
      },
      select: { id: true },
    });
    if (existing) {
      return;
    }
    await this.bookings
      .create(user, { classSessionId, studentId, bookingType: BookingType.FIXED })
      .catch((error: unknown) => {
        if (isUniqueConstraintError(error)) {
          return null;
        }
        throw error;
      });
  }

  private async getStudioTimezone(studioId: string): Promise<string> {
    const studio = await this.prisma.studio.findUniqueOrThrow({
      where: { id: studioId },
      select: { timezone: true },
    });
    return studio.timezone;
  }

  private async assertScheduleRelations(
    studioId: string,
    unitId: string,
    roomId: string,
    professionalId: string,
  ): Promise<void> {
    await Promise.all([
      this.prisma.unit.findFirstOrThrow({ where: { id: unitId, studioId } }),
      this.prisma.room.findFirstOrThrow({ where: { id: roomId, studioId, unitId } }),
      this.prisma.staffMember.findFirstOrThrow({
        where: { id: professionalId, studioId, active: true, archivedAt: null },
      }),
    ]);
  }

  private async resolveScheduleRelations(
    studioId: string,
    unitId: string | undefined,
    roomId: string | undefined,
    professionalId: string,
  ): Promise<{ unitId: string; roomId: string }> {
    await this.prisma.staffMember.findFirstOrThrow({
      where: { id: professionalId, studioId, active: true, archivedAt: null },
    });

    if (roomId) {
      const room = await this.prisma.room.findFirstOrThrow({
        where: { id: roomId, studioId, active: true },
        select: { id: true, unitId: true },
      });
      if (unitId && unitId !== room.unitId) {
        throw new BadRequestException('Sala nao pertence a unidade informada.');
      }
      return { unitId: room.unitId, roomId: room.id };
    }

    const unit = unitId
      ? await this.prisma.unit.findFirstOrThrow({
          where: { id: unitId, studioId, active: true },
        })
      : await this.findOrCreateDefaultUnit(studioId);

    const room =
      (await this.prisma.room.findFirst({
        where: { studioId, unitId: unit.id, active: true },
        orderBy: { createdAt: 'asc' },
      })) ?? (await this.createDefaultRoom(studioId, unit.id));

    return { unitId: unit.id, roomId: room.id };
  }

  private async findOrCreateDefaultUnit(studioId: string): Promise<{ id: string }> {
    const existing = await this.prisma.unit.findFirst({
      where: { studioId, active: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.unit.create({
      data: { studioId, name: DEFAULT_SCHEDULE_UNIT_NAME },
      select: { id: true },
    });
  }

  private async createDefaultRoom(studioId: string, unitId: string): Promise<{ id: string }> {
    return this.prisma.room.create({
      data: {
        studioId,
        unitId,
        name: DEFAULT_SCHEDULE_ROOM_NAME,
        defaultCapacity: DEFAULT_SCHEDULE_ROOM_CAPACITY,
      },
      select: { id: true },
    });
  }
}

type ScheduleWindow = {
  startsOn: Date;
  endsOn: Date | null;
  pauseUntil: Date | null;
};

function isScheduleActiveOn(schedule: ScheduleWindow, day: Date): boolean {
  if (day < schedule.startsOn) {
    return false;
  }
  if (schedule.endsOn && day > schedule.endsOn) {
    return false;
  }
  if (schedule.pauseUntil && day <= schedule.pauseUntil) {
    return false;
  }
  return true;
}

export function matchingLocalDates(
  from: Date,
  to: Date,
  weekday: Weekday,
  timezone: string,
): Date[] {
  const weekdayIndex: Record<Weekday, number> = {
    SUNDAY: 0,
    MONDAY: 1,
    TUESDAY: 2,
    WEDNESDAY: 3,
    THURSDAY: 4,
    FRIDAY: 5,
    SATURDAY: 6,
  };
  const dates: Date[] = [];
  const fromParts = localDateParts(from, timezone);
  const toParts = localDateParts(to, timezone);
  const cursor = new Date(Date.UTC(fromParts.year, fromParts.month - 1, fromParts.day));
  const last = new Date(Date.UTC(toParts.year, toParts.month - 1, toParts.day));
  while (cursor <= last) {
    if (cursor.getUTCDay() === weekdayIndex[weekday]) {
      dates.push(new Date(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function startsAtForLocalDate(day: Date, startTime: string, timezone: string): Date {
  const [hour, minute] = startTime.split(':').map(Number);
  return zonedTimeToUtc(
    {
      year: day.getUTCFullYear(),
      month: day.getUTCMonth() + 1,
      day: day.getUTCDate(),
      hour: hour ?? 0,
      minute: minute ?? 0,
      second: 0,
    },
    timezone,
  );
}

function localDateAfterWeeks(date: Date, weeks: number, timezone: string): Date {
  const parts = localDateParts(date, timezone);
  return addUtcDays(new Date(Date.UTC(parts.year, parts.month - 1, parts.day)), weeks * 7);
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

type LocalDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function localDateParts(
  date: Date,
  timezone: string,
): Pick<LocalDateTimeParts, 'year' | 'month' | 'day'> {
  const parts = dateTimeParts(date, timezone);
  return { year: parts.year, month: parts.month, day: parts.day };
}

function zonedTimeToUtc(parts: LocalDateTimeParts, timezone: string): Date {
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const firstGuess = new Date(localAsUtc);
  const firstOffset = timeZoneOffset(firstGuess, timezone);
  const secondGuess = new Date(localAsUtc - firstOffset);
  const secondOffset = timeZoneOffset(secondGuess, timezone);
  return new Date(localAsUtc - secondOffset);
}

function timeZoneOffset(date: Date, timezone: string): number {
  const parts = dateTimeParts(date, timezone);
  const zonedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return zonedAsUtc - date.getTime();
}

function dateTimeParts(date: Date, timezone: string): LocalDateTimeParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const values = new Map<string, string>();
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') {
      values.set(part.type, part.value);
    }
  }
  const hour = Number(values.get('hour') ?? '0');
  return {
    year: Number(values.get('year') ?? '0'),
    month: Number(values.get('month') ?? '1'),
    day: Number(values.get('day') ?? '1'),
    hour: hour === 24 ? 0 : hour,
    minute: Number(values.get('minute') ?? '0'),
    second: Number(values.get('second') ?? '0'),
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export function timeIntervalsOverlap(startA: string, durationA: number, startB: string, durationB: number): boolean {
  const toMinutes = (value: string): number => {
    const [hours = 0, minutes = 0] = value.split(':').map(Number);
    return hours * 60 + minutes;
  };
  const from = toMinutes(startA);
  const otherFrom = toMinutes(startB);
  return from < otherFrom + durationB && otherFrom < from + durationA;
}
