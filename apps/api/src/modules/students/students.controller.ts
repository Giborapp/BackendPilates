import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { RequirePermissions } from '@/shared/auth/permissions';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { CreateQuickStudentDto, CreateStudentDto, IdParamDto, StudentDuplicateQueryDto, UpdateStudentDto } from '@/shared/http/common.dto';
import { PaginationDto } from '@/shared/http/pagination.dto';
import { StudentsService } from './students.service';

@ApiTags('students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('students')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  @RequirePermissions('students.read')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationDto) {
    return this.students.list(user, query);
  }

  @Get('duplicates/check')
  @RequirePermissions('students.read')
  duplicates(@CurrentUser() user: AuthenticatedUser, @Query() query: StudentDuplicateQueryDto) {
    return this.students.duplicates(user, query);
  }

  @Post('quick')
  @RequirePermissions('students.create')
  createQuick(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateQuickStudentDto) {
    return this.students.createQuick(user, dto);
  }

  @Get(':id')
  @RequirePermissions('students.read')
  get(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    return this.students.get(user, params.id);
  }

  @Post()
  @RequirePermissions('students.create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateStudentDto) {
    return this.students.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions('students.update_basic')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.students.update(user, params.id, dto);
  }

  @Post(':id/archive')
  @RequirePermissions('students.archive')
  archive(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    return this.students.archive(user, params.id);
  }
}
