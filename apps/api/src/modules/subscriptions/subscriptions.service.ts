import { Injectable, NotFoundException } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async get(studioId: string) {
    const subscription = await this.prisma.subscription.findUnique({ where: { studioId } });
    if (!subscription) throw new NotFoundException('Subscription not found');
    return { ...subscription, simulation: true };
  }

  async simulate(user: AuthenticatedUser, status: SubscriptionStatus) {
    const subscription = await this.prisma.subscription.update({
      where: { studioId: user.studioId },
      data: { status },
    });
    await this.audit.record({
      studioId: user.studioId,
      actorStaffId: user.staffMemberId,
      action: 'billing.subscription_simulated',
      entityType: 'Subscription',
      entityId: subscription.id,
      metadata: { status },
    });
    return { ...subscription, simulation: true };
  }
}
