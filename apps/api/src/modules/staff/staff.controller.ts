import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import * as argon2 from 'argon2';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import { RequirePermissions } from '@/shared/auth/permissions';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { CreateStaffDto, IdParamDto, ResetPinDto, UpdateStaffDto } from '@/shared/http/common.dto';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { assertPinAllowed } from '../auth/pin-policy';
import { sha256 } from '../auth/token.util';

@ApiTags('staff')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('staff')
export class StaffController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions('staff.manage')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.prisma.staffMember.findMany({
      where: { studioId: user.studioId, archivedAt: null },
      select: { id: true, name: true, photoUrl: true, role: true, permissions: true, active: true, lastLoginAt: true, createdAt: true, updatedAt: true },
    });
  }

  @Post()
  @RequirePermissions('staff.manage')
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateStaffDto) {
    assertPinAllowed(dto.pin);
    const staff = await this.prisma.staffMember.create({
      data: {
        studioId: user.studioId,
        name: dto.name,
        role: dto.role,
        pinHash: await argon2.hash(dto.pin),
        pinLookupHash: sha256(`${user.studioId}:${dto.pin}`),
        permissions: dto.permissions ?? [],
        active: dto.active ?? true,
      },
      select: { id: true, name: true, role: true, permissions: true, active: true, createdAt: true },
    });
    await this.audit.record({ studioId: user.studioId, actorStaffId: user.staffMemberId, action: 'staff.create', entityType: 'StaffMember', entityId: staff.id, after: staff });
    return staff;
  }

  @Patch(':id')
  @RequirePermissions('staff.manage')
  async update(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto, @Body() dto: UpdateStaffDto) {
    const before = await this.prisma.staffMember.findFirstOrThrow({ where: { id: params.id, studioId: user.studioId } });
    const staff = await this.prisma.staffMember.update({
      where: { id: before.id },
      data: dto,
      select: { id: true, name: true, role: true, permissions: true, active: true, updatedAt: true },
    });
    await this.audit.record({ studioId: user.studioId, actorStaffId: user.staffMemberId, action: 'staff.update', entityType: 'StaffMember', entityId: staff.id, before: sanitizeStaff(before), after: staff });
    return staff;
  }

  @Post(':id/reset-pin')
  @RequirePermissions('staff.manage')
  async resetPin(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto, @Body() dto: ResetPinDto) {
    assertPinAllowed(dto.pin);
    const staff = await this.prisma.staffMember.findFirstOrThrow({ where: { id: params.id, studioId: user.studioId } });
    await this.prisma.staffMember.update({
      where: { id: staff.id },
      data: { pinHash: await argon2.hash(dto.pin), pinLookupHash: sha256(`${user.studioId}:${dto.pin}`) },
    });
    await this.audit.record({ studioId: user.studioId, actorStaffId: user.staffMemberId, action: 'staff.pin_reset', entityType: 'StaffMember', entityId: staff.id });
    return { reset: true };
  }
}

function sanitizeStaff(staff: Prisma.StaffMemberGetPayload<object>) {
  return { id: staff.id, name: staff.name, role: staff.role, permissions: staff.permissions, active: staff.active };
}
