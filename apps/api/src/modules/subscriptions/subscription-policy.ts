import { SubscriptionPlan } from '@prisma/client';

export function subscriptionMonthlyAmount(plan: SubscriptionPlan): string {
  return plan === SubscriptionPlan.PROFESSIONAL ? '179.00' : '99.00';
}

export function subscriptionPeriodEnd(start: Date): Date {
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth();
  const day = start.getUTCDate();
  const lastDayOfNextMonth = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();
  return new Date(Date.UTC(year, month + 1, Math.min(day, lastDayOfNextMonth)));
}
