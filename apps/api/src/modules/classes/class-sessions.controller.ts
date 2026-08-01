import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { RequireAnyPermission, RequirePermissions } from '@/shared/auth/permissions';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { CreateClassSessionDto, IdParamDto, UpdateClassSessionDto } from '@/shared/http/common.dto';
import { ClassSessionsService } from './class-sessions.service';

@ApiTags('class-sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('class-sessions')
export class ClassSessionsController {
  constructor(private readonly classSessions: ClassSessionsService) {}

  @Get()
  @RequireAnyPermission('classes.read_own', 'classes.read_all')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.classSessions.list(user);
  }

  @Get(':id')
  @RequireAnyPermission('classes.read_own', 'classes.read_all')
  get(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    return this.classSessions.get(user, params.id);
  }

  @Post()
  @RequirePermissions('classes.create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateClassSessionDto) {
    return this.classSessions.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions('classes.update')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateClassSessionDto,
  ) {
    return this.classSessions.update(user, params.id, body);
  }

  @Post(':id/cancel')
  @RequirePermissions('classes.cancel')
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: { cancellationReason?: string },
  ) {
    return this.classSessions.cancel(user, params.id, body.cancellationReason);
  }
}
