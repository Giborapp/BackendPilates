import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { RequirePermissions } from '@/shared/auth/permissions';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { CreateClassSessionDto, IdParamDto } from '@/shared/http/common.dto';
import { ClassSessionsService } from './class-sessions.service';

@ApiTags('class-sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('class-sessions')
export class ClassSessionsController {
  constructor(private readonly classSessions: ClassSessionsService) {}

  @Get()
  @RequirePermissions('classes.read_all')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.classSessions.list(user);
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
    @Body() body: Prisma.ClassSessionUpdateInput,
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
