import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { RequirePermissions } from '@/shared/auth/permissions';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { CreateTemplateDto, IdParamDto } from '@/shared/http/common.dto';
import { parseTemplateFields } from '@/shared/domain/assessment-validator';
import { PrismaService } from '@/shared/prisma/prisma.service';

@ApiTags('assessment-templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('assessment-templates')
export class AssessmentTemplatesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('assessments.read')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.prisma.assessmentTemplate.findMany({ where: { studioId: user.studioId, archivedAt: null } });
  }

  @Post()
  @RequirePermissions('assessment_templates.manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTemplateDto) {
    const fields = parseTemplateFields(dto.fields);
    return this.prisma.assessmentTemplate.create({ data: { studioId: user.studioId, name: dto.name, description: dto.description, fields, createdByStaffId: user.staffMemberId } });
  }

  @Patch(':id')
  @RequirePermissions('assessment_templates.manage')
  async newVersion(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto, @Body() dto: CreateTemplateDto) {
    const before = await this.prisma.assessmentTemplate.findFirstOrThrow({ where: { id: params.id, studioId: user.studioId } });
    const fields = parseTemplateFields(dto.fields);
    await this.prisma.assessmentTemplate.update({ where: { id: before.id }, data: { active: false, archivedAt: new Date() } });
    return this.prisma.assessmentTemplate.create({ data: { studioId: user.studioId, name: dto.name ?? before.name, description: dto.description ?? before.description, version: before.version + 1, fields, createdByStaffId: user.staffMemberId } });
  }
}
