ALTER TABLE "Studio" ADD COLUMN "responsibleCpf" TEXT;

CREATE TYPE "SubscriptionPlan" AS ENUM ('STARTER', 'PROFESSIONAL');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED');

CREATE TABLE "Subscription" (
    "id" UUID NOT NULL,
    "studioId" UUID NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'STARTER',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "monthlyAmount" DECIMAL(12,2) NOT NULL,
    "currentPeriodStart" DATE NOT NULL,
    "currentPeriodEnd" DATE NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Subscription_studioId_key" ON "Subscription"("studioId");
CREATE INDEX "Subscription_status_currentPeriodEnd_idx" ON "Subscription"("status", "currentPeriodEnd");
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
