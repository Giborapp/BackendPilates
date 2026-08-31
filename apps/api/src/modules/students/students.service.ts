import { BadRequestException, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { CreateQuickStudentDto, CreateStudentDto, StudentDuplicateQueryDto, UpdateStudentDto } from '@/shared/http/common.dto';
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
      include: { plans: { where: { status: 'ACTIVE' }, include: { plan: true }, orderBy: { startDate: 'desc' } }, payments: { orderBy: { dueDate: 'asc' }, take: 12 } },
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

  async duplicates(user: AuthenticatedUser, query: StudentDuplicateQueryDto) {
    const conditions = [query.phone ? { phone: query.phone } : null, query.email ? { email: query.email } : null].filter((condition): condition is { phone: string } | { email: string } => condition !== null);
    if (conditions.length === 0) return [];
    return this.prisma.student.findMany({ where: { studioId: user.studioId, archivedAt: null, OR: conditions }, select: { id: true, fullName: true, phone: true, email: true } });
  }

  async createQuick(user: AuthenticatedUser, dto: CreateQuickStudentDto) {
    const duplicate = await this.prisma.student.findFirst({ where: { studioId: user.studioId, archivedAt: null, phone: dto.phone } });
    if (duplicate) throw new BadRequestException('A student with this phone already exists');
    const result = await this.prisma.$transaction(async (tx) => {
      const plan = dto.planId ? await tx.plan.findFirstOrThrow({ where: { id: dto.planId, studioId: user.studioId, active: true } }) : null;
      const student = await tx.student.create({ data: { studioId: user.studioId, fullName: dto.fullName.trim(), phone: dto.phone.trim(), startDate: new Date(dto.startDate), status: 'ACTIVE' } });
      const studentPlan = plan ? await tx.studentPlan.create({ data: { studioId: user.studioId, studentId: student.id, planId: plan.id, sessionsPerWeek: dto.sessionsPerWeek, amount: dto.amount ?? plan.defaultAmount, billingDay: dto.billingDay, startDate: new Date(dto.startDate) } }) : null;
      return { student, studentPlan };
    });
    await this.audit.record({ studioId: user.studioId, actorStaffId: user.staffMemberId, action: 'students.quick_create', entityType: 'Student', entityId: result.student.id, metadata: { hasPlan: Boolean(result.studentPlan), sessionsPerWeek: dto.sessionsPerWeek } });
    return result;
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
