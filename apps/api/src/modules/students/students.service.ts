import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { CreateStudentDto, UpdateStudentDto } from '@/shared/http/common.dto';
import { PaginationDto } from '@/shared/http/pagination.dto';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AttendanceService, withLessonBalance } from '../attendance/attendance.service';

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly attendance: AttendanceService,
  ) {}

  async list(user: AuthenticatedUser, query: PaginationDto) {
    const skip = (query.page - 1) * query.perPage;
    const where = { studioId: user.studioId, archivedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        skip,
        take: query.perPage,
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.student.count({ where }),
    ]);
    const usage = await this.attendance.studentMonthlyUsage(
      user.studioId,
      items.map((student) => student.id),
    );
    return {
      items: items.map((student) => withLessonBalance(student, usage.get(student.id) ?? 0)),
      total,
      page: query.page,
      perPage: query.perPage,
    };
  }

  async get(user: AuthenticatedUser, id: string) {
    const student = await this.prisma.student.findFirstOrThrow({
      where: { id, studioId: user.studioId, archivedAt: null },
    });
    const usage = await this.attendance.studentMonthlyUsage(user.studioId, [student.id]);
    return withLessonBalance(student, usage.get(student.id) ?? 0);
  }

  async create(user: AuthenticatedUser, dto: CreateStudentDto) {
    const student = await this.prisma.student.create({
      data: {
        ...dto,
        studioId: user.studioId,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      },
    });
    await this.audit.record({
      studioId: user.studioId,
      actorStaffId: user.staffMemberId,
      action: 'students.create',
      entityType: 'Student',
      entityId: student.id,
      after: student,
    });
    return student;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateStudentDto) {
    const before = await this.prisma.student.findFirstOrThrow({
      where: { id, studioId: user.studioId },
    });
    const student = await this.prisma.student.update({
      where: { id: before.id },
      data: {
        ...dto,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      },
    });
    await this.audit.record({
      studioId: user.studioId,
      actorStaffId: user.staffMemberId,
      action: 'students.update',
      entityType: 'Student',
      entityId: student.id,
      before,
      after: student,
    });
    return student;
  }

  async archive(user: AuthenticatedUser, id: string) {
    const student = await this.prisma.student.update({
      where: { id, studioId: user.studioId },
      data: { archivedAt: new Date(), status: 'ARCHIVED' },
    });
    await this.audit.record({
      studioId: user.studioId,
      actorStaffId: user.staffMemberId,
      action: 'students.archive',
      entityType: 'Student',
      entityId: student.id,
    });
    return student;
  }
}
