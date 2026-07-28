import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReplacementCreditStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { RequirePermissions } from '@/shared/auth/permissions';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { IdParamDto } from '@/shared/http/common.dto';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

class CreditQueryDto {
  @IsOptional() @IsEnum(ReplacementCreditStatus) status?: ReplacementCreditStatus;
}

@ApiTags('replacement-credits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('replacement-credits')
export class ReplacementCreditsController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions('attendance.read')
  async list(@CurrentUser() user: AuthenticatedUser, @Query() query: CreditQueryDto) {
    await this.expireCredits(user.studioId);
    return this.prisma.replacementCredit.findMany({ where: { studioId: user.studioId, status: query.status }, include: { student: true } });
  }

  @Post(':id/approve')
  @RequirePermissions('attendance.manage')
  async approve(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    const credit = await this.prisma.replacementCredit.update({ where: { id: params.id, studioId: user.studioId }, data: { status: 'AVAILABLE', approvedByStaffId: user.staffMemberId } });
    await this.audit.record({ studioId: user.studioId, actorStaffId: user.staffMemberId, action: 'replacement_credits.approve', entityType: 'ReplacementCredit', entityId: credit.id });
    return credit;
  }

  @Post(':id/cancel')
  @RequirePermissions('attendance.manage')
  async cancel(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    const credit = await this.prisma.replacementCredit.update({ where: { id: params.id, studioId: user.studioId }, data: { status: 'CANCELLED' } });
    await this.audit.record({ studioId: user.studioId, actorStaffId: user.staffMemberId, action: 'replacement_credits.cancel', entityType: 'ReplacementCredit', entityId: credit.id });
    return credit;
  }

  private async expireCredits(studioId: string): Promise<void> {
    await this.prisma.replacementCredit.updateMany({
      where: { studioId, status: { in: ['AVAILABLE', 'RESERVED'] }, expiresAt: { lt: new Date() } },
      data: { status: 'EXPIRED' },
    });
  }
}
