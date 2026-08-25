import { Injectable } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { CreatePaymentDto, PaymentActionDto, PaymentQueryDto } from '@/shared/http/common.dto';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthenticatedUser, query: PaymentQueryDto) {
    const where = { studioId: user.studioId, status: query.status, studentId: query.studentId };
    const items = await this.prisma.payment.findMany({
      where,
      include: { student: true },
      orderBy: { dueDate: 'asc' },
    });
    return {
      items: items.map((payment) => ({
        ...payment,
        effectiveStatus: effectivePaymentStatus(payment.status, payment.dueDate),
      })),
    };
  }

  async create(user: AuthenticatedUser, dto: CreatePaymentDto) {
    await this.prisma.student.findFirstOrThrow({
      where: { id: dto.studentId, studioId: user.studioId },
    });
    const payment = await this.prisma.payment.create({
      data: {
        ...dto,
        studioId: user.studioId,
        referenceMonth: new Date(dto.referenceMonth),
        dueDate: new Date(dto.dueDate),
      },
    });
    await this.audit.record({
      studioId: user.studioId,
      actorStaffId: user.staffMemberId,
      action: 'payments.create',
      entityType: 'Payment',
      entityId: payment.id,
      after: payment,
    });
    return payment;
  }

  pay(user: AuthenticatedUser, id: string, dto: PaymentActionDto) {
    return this.changeStatus(user, id, PaymentStatus.PAID, {
      paidAt: new Date(),
      paymentMethod: dto.paymentMethod,
      notes: dto.notes,
    });
  }

  waive(user: AuthenticatedUser, id: string, dto: PaymentActionDto) {
    return this.changeStatus(user, id, PaymentStatus.WAIVED, { notes: dto.notes });
  }

  cancel(user: AuthenticatedUser, id: string, dto: PaymentActionDto) {
    return this.changeStatus(user, id, PaymentStatus.CANCELLED, { notes: dto.notes });
  }

  async update(user: AuthenticatedUser, id: string, dto: Partial<CreatePaymentDto>) {
    const before = await this.prisma.payment.findFirstOrThrow({
      where: { id, studioId: user.studioId },
    });
    const payment = await this.prisma.payment.update({
      where: { id: before.id },
      data: {
        ...dto,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        referenceMonth: dto.referenceMonth ? new Date(dto.referenceMonth) : undefined,
      },
    });
    await this.audit.record({
      studioId: user.studioId,
      actorStaffId: user.staffMemberId,
      action: 'payments.update',
      entityType: 'Payment',
      entityId: payment.id,
      before,
      after: payment,
    });
    return payment;
  }

  private async changeStatus(
    user: AuthenticatedUser,
    id: string,
    status: PaymentStatus,
    data: object,
  ) {
    const before = await this.prisma.payment.findFirstOrThrow({
      where: { id, studioId: user.studioId },
    });
    const payment = await this.prisma.payment.update({
      where: { id: before.id },
      data: { ...data, status },
    });
    await this.audit.record({
      studioId: user.studioId,
      actorStaffId: user.staffMemberId,
      action: `payments.${status.toLowerCase()}`,
      entityType: 'Payment',
      entityId: payment.id,
      before,
      after: payment,
    });
    return payment;
  }
}

function effectivePaymentStatus(status: PaymentStatus, dueDate: Date): PaymentStatus {
  if (status === PaymentStatus.PENDING && dueDate < new Date()) {
    return PaymentStatus.OVERDUE;
  }
  return status;
}
