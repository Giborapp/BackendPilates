import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { RequirePermissions } from '@/shared/auth/permissions';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { PaginationDto } from '@/shared/http/pagination.dto';
import { PrismaService } from '@/shared/prisma/prisma.service';

@ApiTags('audit-logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('audit_logs.read')
  async list(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationDto) {
    const skip = (query.page - 1) * query.perPage;
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { studioId: user.studioId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.perPage,
      }),
      this.prisma.auditLog.count({ where: { studioId: user.studioId } }),
    ]);
    return { items, total, page: query.page, perPage: query.perPage };
  }
}
