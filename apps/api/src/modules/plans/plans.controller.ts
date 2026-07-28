import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { RequirePermissions } from '@/shared/auth/permissions';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { CreatePlanDto, IdParamDto } from '@/shared/http/common.dto';
import { PrismaService } from '@/shared/prisma/prisma.service';

@ApiTags('plans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('plans')
export class PlansController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('payments.read')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.prisma.plan.findMany({ where: { studioId: user.studioId, active: true } });
  }

  @Post()
  @RequirePermissions('payments.manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePlanDto) {
    return this.prisma.plan.create({ data: { ...dto, studioId: user.studioId } });
  }

  @Patch(':id')
  @RequirePermissions('payments.manage')
  update(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto, @Body() dto: Partial<CreatePlanDto>) {
    return this.prisma.plan.update({ where: { id: params.id, studioId: user.studioId }, data: dto });
  }
}
