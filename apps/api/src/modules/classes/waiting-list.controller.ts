import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { RequirePermissions } from '@/shared/auth/permissions';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { PrismaService } from '@/shared/prisma/prisma.service';

class WaitingListDto {
  @IsUUID() classSessionId!: string;
  @IsUUID() studentId!: string;
}

@ApiTags('waiting-list')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('waiting-list')
export class WaitingListController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('classes.read_all')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.prisma.waitingListEntry.findMany({ where: { studioId: user.studioId } });
  }

  @Post()
  @RequirePermissions('classes.update')
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: WaitingListDto) {
    const position = await this.prisma.waitingListEntry.count({ where: { studioId: user.studioId, classSessionId: dto.classSessionId, status: 'WAITING' } }) + 1;
    return this.prisma.waitingListEntry.create({ data: { studioId: user.studioId, classSessionId: dto.classSessionId, studentId: dto.studentId, position } });
  }
}
