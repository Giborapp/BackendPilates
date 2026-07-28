import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { RequirePermissions } from '@/shared/auth/permissions';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { CreateRoomDto, IdParamDto } from '@/shared/http/common.dto';
import { PrismaService } from '@/shared/prisma/prisma.service';

@ApiTags('rooms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('rooms')
export class RoomsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('classes.read_all')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.prisma.room.findMany({ where: { studioId: user.studioId, active: true } });
  }

  @Post()
  @RequirePermissions('studio_settings.manage')
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRoomDto) {
    await this.prisma.unit.findFirstOrThrow({ where: { id: dto.unitId, studioId: user.studioId } });
    return this.prisma.room.create({ data: { ...dto, studioId: user.studioId } });
  }

  @Patch(':id')
  @RequirePermissions('studio_settings.manage')
  update(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto, @Body() dto: Partial<CreateRoomDto>) {
    return this.prisma.room.update({ where: { id: params.id, studioId: user.studioId }, data: dto });
  }
}
