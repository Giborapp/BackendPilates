import { SubscriptionPlan } from '@prisma/client';
import { subscriptionMonthlyAmount, subscriptionPeriodEnd } from '../src/modules/subscriptions/subscription-policy';

describe('subscription policy', () => {
  it('uses the configured simulated monthly prices', () => {
    expect(subscriptionMonthlyAmount(SubscriptionPlan.STARTER)).toBe('99.00');
    expect(subscriptionMonthlyAmount(SubscriptionPlan.PROFESSIONAL)).toBe('179.00');
  });

  it('keeps the initial period to one month without overflowing day 31', () => {
    expect(subscriptionPeriodEnd(new Date('2026-01-31T12:00:00.000Z')).toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(subscriptionPeriodEnd(new Date('2028-01-31T12:00:00.000Z')).toISOString()).toBe('2028-02-29T00:00:00.000Z');
  });
});
