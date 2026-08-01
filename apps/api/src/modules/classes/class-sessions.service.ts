import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { CreateClassSessionDto, UpdateClassSessionDto } from '@/shared/http/common.dto';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AttendanceService, withLessonBalance } from '../attendance/attendance.service';

@Injectable()
export class ClassSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly attendance: AttendanceService,
  ) {}

  async list(user: AuthenticatedUser) {
    await this.attendance.markAutomaticNoShows(user.studioId);
    const where = user.permissions.includes('classes.read_all')
      ? { studioId: user.studioId }
      : { studioId: user.studioId, professionalId: user.staffMemberId };
    const sessions = await this.prisma.classSession.findMany({
      where,
      include: {
        professional: { select: { id: true, name: true } },
        bookings: {
          where: { status: { not: 'CANCELLED' } },
          include: { student: true, attendance: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { startsAt: 'asc' },
    });
    return this.attachStudentBalances(sessions, user.studioId);
  }

  async get(user: AuthenticatedUser, id: string) {
    await this.attendance.markAutomaticNoShows(user.studioId);
    const where = user.permissions.includes('classes.read_all')
      ? { id, studioId: user.studioId }
      : { id, studioId: user.studioId, professionalId: user.staffMemberId };
    const session = await this.prisma.classSession.findFirstOrThrow({
      where,
      include: {
        professional: { select: { id: true, name: true } },
        bookings: {
          where: { status: { not: 'CANCELLED' } },
          include: { student: true, attendance: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    const [sessionWithBalances] = await this.attachStudentBalances([session], user.studioId);
    return sessionWithBalances;
  }

  async create(user: AuthenticatedUser, dto: CreateClassSessionDto) {
    await Promise.all([
      this.prisma.unit.findFirstOrThrow({ where: { id: dto.unitId, studioId: user.studioId } }),
      this.prisma.room.findFirstOrThrow({ where: { id: dto.roomId, studioId: user.studioId } }),
      this.prisma.staffMember.findFirstOrThrow({
        where: { id: dto.professionalId, studioId: user.studioId, active: true, archivedAt: null },
      }),
    ]);
    const session = await this.prisma.classSession.create({
      data: {
        ...dto,
        studioId: user.studioId,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
      },
    });
    await this.audit.record({
      studioId: user.studioId,
      actorStaffId: user.staffMemberId,
      action: 'classes.create',
      entityType: 'ClassSession',
      entityId: session.id,
      after: session,
    });
    return session;
  }

  async update(user: AuthenticatedUser, id: string, body: UpdateClassSessionDto) {
    const before = await this.prisma.classSession.findFirstOrThrow({
      where: { id, studioId: user.studioId },
    });
    await Promise.all([
      body.unitId
        ? this.prisma.unit.findFirstOrThrow({ where: { id: body.unitId, studioId: user.studioId } })
        : Promise.resolve(),
      body.roomId
        ? this.prisma.room.findFirstOrThrow({
            where: { id: body.roomId, studioId: user.studioId, unitId: body.unitId ?? before.unitId },
          })
        : Promise.resolve(),
      body.professionalId
        ? this.prisma.staffMember.findFirstOrThrow({
            where: { id: body.professionalId, studioId: user.studioId, active: true, archivedAt: null },
          })
        : Promise.resolve(),
    ]);
    const after = await this.prisma.classSession.update({
      where: { id: before.id },
      data: {
        ...body,
        startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
        endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
      },
    });
    await this.audit.record({
      studioId: user.studioId,
      actorStaffId: user.staffMemberId,
      action: 'classes.update',
      entityType: 'ClassSession',
      entityId: after.id,
      before,
      after,
    });
    return after;
  }

  async cancel(user: AuthenticatedUser, id: string, cancellationReason?: string) {
    const session = await this.prisma.classSession.update({
      where: { id, studioId: user.studioId },
      data: { status: 'CANCELLED', cancellationReason },
    });
    await this.audit.record({
      studioId: user.studioId,
      actorStaffId: user.staffMemberId,
      action: 'classes.cancel',
      entityType: 'ClassSession',
      entityId: session.id,
    });
    return session;
  }

  private async attachStudentBalances<T extends SessionWithBookings>(
    sessions: T[],
    studioId: string,
  ) {
    const studentIds = [
      ...new Set(
        sessions.flatMap((session) => session.bookings.map((booking) => booking.student.id)),
      ),
    ];
    const usage = await this.attendance.studentMonthlyUsage(studioId, studentIds);
    return sessions.map((session) => ({
      ...session,
      bookings: session.bookings.map((booking) => ({
        ...booking,
        student: withLessonBalance(booking.student, usage.get(booking.student.id) ?? 0),
      })),
    }));
  }
}

type SessionWithBookings = Prisma.ClassSessionGetPayload<{
  include: {
    professional: { select: { id: true; name: true } };
    bookings: {
      include: { student: true; attendance: true };
    };
  };
}>;
