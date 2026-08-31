import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { RequirePermissions } from '@/shared/auth/permissions';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { CreateTemplateDto, IdParamDto } from '@/shared/http/common.dto';
import { AssessmentTemplatesService } from './assessment-templates.service';

@ApiTags('assessment-templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('assessment-templates')
export class AssessmentTemplatesController {
  constructor(private readonly templates: AssessmentTemplatesService) {}

  @Get('presets')
  @RequirePermissions('assessments.read')
  presets() {
    return this.templates.presets();
  }

  @Post('presets/:key/copy')
  @RequirePermissions('assessment_templates.manage')
  clonePreset(@CurrentUser() user: AuthenticatedUser, @Param('key') key: string) {
    return this.templates.clonePreset(user, key);
  }

  @Get()
  @RequirePermissions('assessments.read')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.templates.list(user);
  }

  @Get(':id')
  @RequirePermissions('assessments.read')
  get(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    return this.templates.get(user, params.id);
  }

  @Post()
  @RequirePermissions('assessment_templates.manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTemplateDto) {
    return this.templates.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions('assessment_templates.manage')
  update(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto, @Body() dto: CreateTemplateDto) {
    return this.templates.update(user, params.id, dto);
  }

  @Post(':id/publish')
  @RequirePermissions('assessment_templates.manage')
  publish(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    return this.templates.publish(user, params.id);
  }

  @Post(':id/archive')
  @RequirePermissions('assessment_templates.manage')
  archive(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    return this.templates.archive(user, params.id);
  }

  @Post(':id/restore')
  @RequirePermissions('assessment_templates.manage')
  restore(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    return this.templates.restore(user, params.id);
  }
}
