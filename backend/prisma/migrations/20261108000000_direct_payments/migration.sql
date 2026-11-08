ALTER TABLE "Order" ADD COLUMN "checkoutTokenHash" TEXT, ADD COLUMN "idempotencyKey" TEXT, ADD COLUMN "requestFingerprint" TEXT, ADD COLUMN "autoRenew" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "recurringConsentAt" TIMESTAMP(3), ADD COLUMN "stripeDirectSubscriptionId" TEXT, ADD COLUMN "providerProcessing" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");
CREATE UNIQUE INDEX "Order_stripeDirectSubscriptionId_key" ON "Order"("stripeDirectSubscriptionId");
ALTER TABLE "Subscription" ALTER COLUMN "stripeSubscriptionId" DROP NOT NULL, ADD COLUMN "autoRenew" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN "recurringConsentAt" TIMESTAMP(3), ADD COLUMN "paidThrough" TIMESTAMP(3), ADD COLUMN "finiteOrderItemId" TEXT;
CREATE UNIQUE INDEX "Subscription_finiteOrderItemId_key" ON "Subscription"("finiteOrderItemId");
