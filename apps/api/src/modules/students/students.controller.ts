import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { RequirePermissions } from '@/shared/auth/permissions';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { CreateStudentDto, IdParamDto, UpdateStudentDto } from '@/shared/http/common.dto';
import { PaginationDto } from '@/shared/http/pagination.dto';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@ApiTags('students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('students')
export class StudentsController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions('students.read')
  async list(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationDto) {
    const skip = (query.page - 1) * query.perPage;
    const where = { studioId: user.studioId, archivedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.student.findMany({ where, skip, take: query.perPage, orderBy: { fullName: 'asc' } }),
      this.prisma.student.count({ where }),
    ]);
    return { items, total, page: query.page, perPage: query.perPage };
  }

  @Get(':id')
  @RequirePermissions('students.read')
  get(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    return this.prisma.student.findFirstOrThrow({ where: { id: params.id, studioId: user.studioId, archivedAt: null } });
  }

  @Post()
  @RequirePermissions('students.create')
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateStudentDto) {
    const student = await this.prisma.student.create({ data: { ...dto, studioId: user.studioId, birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined, startDate: dto.startDate ? new Date(dto.startDate) : undefined } });
    await this.audit.record({ studioId: user.studioId, actorStaffId: user.staffMemberId, action: 'students.create', entityType: 'Student', entityId: student.id, after: student });
    return student;
  }

  @Patch(':id')
  @RequirePermissions('students.update_basic')
  async update(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto, @Body() dto: UpdateStudentDto) {
    const before = await this.prisma.student.findFirstOrThrow({ where: { id: params.id, studioId: user.studioId } });
    const student = await this.prisma.student.update({ where: { id: before.id }, data: { ...dto, birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined, startDate: dto.startDate ? new Date(dto.startDate) : undefined } });
    await this.audit.record({ studioId: user.studioId, actorStaffId: user.staffMemberId, action: 'students.update', entityType: 'Student', entityId: student.id, before, after: student });
    return student;
  }

  @Post(':id/archive')
  @RequirePermissions('students.archive')
  async archive(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    const student = await this.prisma.student.update({ where: { id: params.id, studioId: user.studioId }, data: { archivedAt: new Date(), status: 'ARCHIVED' } });
    await this.audit.record({ studioId: user.studioId, actorStaffId: user.staffMemberId, action: 'students.archive', entityType: 'Student', entityId: student.id });
    return student;
  }
}
