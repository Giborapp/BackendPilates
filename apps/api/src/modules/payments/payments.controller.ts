import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { RequirePermissions } from '@/shared/auth/permissions';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { CreatePaymentDto, IdParamDto, PaymentActionDto, PaymentQueryDto } from '@/shared/http/common.dto';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions('payments.read')
  async list(@CurrentUser() user: AuthenticatedUser, @Query() query: PaymentQueryDto) {
    const where = { studioId: user.studioId, status: query.status, studentId: query.studentId };
    const items = await this.prisma.payment.findMany({ where, include: { student: true }, orderBy: { dueDate: 'asc' } });
    return { items: items.map((payment) => ({ ...payment, effectiveStatus: effectivePaymentStatus(payment.status, payment.dueDate) })) };
  }

  @Post()
  @RequirePermissions('payments.manage')
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePaymentDto) {
    await this.prisma.student.findFirstOrThrow({ where: { id: dto.studentId, studioId: user.studioId } });
    const payment = await this.prisma.payment.create({
      data: { ...dto, studioId: user.studioId, referenceMonth: new Date(dto.referenceMonth), dueDate: new Date(dto.dueDate) },
    });
    await this.audit.record({ studioId: user.studioId, actorStaffId: user.staffMemberId, action: 'payments.create', entityType: 'Payment', entityId: payment.id, after: payment });
    return payment;
  }

  @Post(':id/pay')
  @RequirePermissions('payments.manage')
  async pay(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto, @Body() dto: PaymentActionDto) {
    return this.changeStatus(user, params.id, PaymentStatus.PAID, { paidAt: new Date(), paymentMethod: dto.paymentMethod, notes: dto.notes });
  }

  @Post(':id/waive')
  @RequirePermissions('payments.manage')
  waive(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto, @Body() dto: PaymentActionDto) {
    return this.changeStatus(user, params.id, PaymentStatus.WAIVED, { notes: dto.notes });
  }

  @Post(':id/cancel')
  @RequirePermissions('payments.manage')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto, @Body() dto: PaymentActionDto) {
    return this.changeStatus(user, params.id, PaymentStatus.CANCELLED, { notes: dto.notes });
  }

  @Patch(':id')
  @RequirePermissions('payments.manage')
  async update(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto, @Body() dto: Partial<CreatePaymentDto>) {
    const before = await this.prisma.payment.findFirstOrThrow({ where: { id: params.id, studioId: user.studioId } });
    const payment = await this.prisma.payment.update({ where: { id: before.id }, data: { ...dto, dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined, referenceMonth: dto.referenceMonth ? new Date(dto.referenceMonth) : undefined } });
    await this.audit.record({ studioId: user.studioId, actorStaffId: user.staffMemberId, action: 'payments.update', entityType: 'Payment', entityId: payment.id, before, after: payment });
    return payment;
  }

  private async changeStatus(user: AuthenticatedUser, id: string, status: PaymentStatus, data: object) {
    const before = await this.prisma.payment.findFirstOrThrow({ where: { id, studioId: user.studioId } });
    const payment = await this.prisma.payment.update({ where: { id: before.id }, data: { ...data, status } });
    await this.audit.record({ studioId: user.studioId, actorStaffId: user.staffMemberId, action: `payments.${status.toLowerCase()}`, entityType: 'Payment', entityId: payment.id, before, after: payment });
    return payment;
  }
}

function effectivePaymentStatus(status: PaymentStatus, dueDate: Date): PaymentStatus {
  if (status === PaymentStatus.PENDING && dueDate < new Date()) {
    return PaymentStatus.OVERDUE;
  }
  return status;
}
