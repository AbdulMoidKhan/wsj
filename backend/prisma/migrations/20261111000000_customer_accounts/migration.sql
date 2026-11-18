-- Customer accounts: identity, sessions, single-use tokens, transactional outbox,
-- card mirror, operation records, plan changes and support requests.
--
-- Strictly additive. No table, column or row is dropped or rewritten except:
--   * the single-column unique index on "Customer"."email" is replaced by a unique
--     index on the new "emailKey" (see the collision-aware backfill below).
-- Existing Customer, Booking, Order, Subscription, Invoice and EntitlementEntry
-- rows keep their ids and relations.

-- CreateEnum
CREATE TYPE "CustomerAccountStatus" AS ENUM ('GUEST', 'PENDING_SETUP', 'ACTIVE');

-- AlterTable: Customer
ALTER TABLE "Customer"
  ADD COLUMN "emailKey" TEXT,
  ADD COLUMN "company" TEXT,
  ADD COLUMN "billingAddress" JSONB,
  ADD COLUMN "accountStatus" "CustomerAccountStatus" NOT NULL DEFAULT 'GUEST',
  ADD COLUMN "shadowState" TEXT,
  ADD COLUMN "mergedIntoId" TEXT,
  ADD COLUMN "passwordHash" TEXT,
  ADD COLUMN "passwordChangedAt" TIMESTAMP(3),
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "pendingEmail" TEXT,
  ADD COLUMN "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedUntil" TIMESTAMP(3),
  ADD COLUMN "lastLoginAt" TIMESTAMP(3),
  ADD COLUMN "accountTermsVersion" TEXT,
  ADD COLUMN "accountTermsAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "cardConsentAt" TIMESTAMP(3),
  ADD COLUMN "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "marketingConsentAt" TIMESTAMP(3),
  ADD COLUMN "notificationPrefs" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "cardStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "cardCheckedAt" TIMESTAMP(3),
  ADD COLUMN "closureRequestedAt" TIMESTAMP(3),
  ADD COLUMN "mutationLockToken" TEXT,
  ADD COLUMN "mutationLockUntil" TIMESTAMP(3);

-- Collision-aware identity backfill.
-- "emailKey" = lower(trim(email)) for exactly one row per address. When two legacy
-- rows differ only by case/whitespace, the row that already owns a Stripe customer
-- (then the oldest) keeps the login identity; the others keep all their data but
-- get emailKey NULL and shadowState 'COLLISION' so staff can resolve them. Nothing
-- is merged or deleted automatically.
WITH ranked AS (
  SELECT "id",
         lower(btrim("email")) AS k,
         row_number() OVER (
           PARTITION BY lower(btrim("email"))
           ORDER BY ("stripeCustomerId" IS NULL), "createdAt", "id"
         ) AS rn
  FROM "Customer"
)
UPDATE "Customer" c
SET "emailKey" = CASE WHEN r.rn = 1 THEN r.k ELSE NULL END,
    "shadowState" = CASE WHEN r.rn = 1 THEN NULL ELSE 'COLLISION' END
FROM ranked r
WHERE r."id" = c."id";

-- The old unique index made a second row per address impossible; identity
-- uniqueness now lives on "emailKey".
DROP INDEX IF EXISTS "Customer_email_key";
CREATE UNIQUE INDEX "Customer_emailKey_key" ON "Customer"("emailKey");
CREATE INDEX "Customer_email_idx" ON "Customer"("email");
CREATE INDEX "Customer_mergedIntoId_idx" ON "Customer"("mergedIntoId");
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Order (checkout contact snapshot)
ALTER TABLE "Order"
  ADD COLUMN "contactName" TEXT,
  ADD COLUMN "contactEmail" TEXT,
  ADD COLUMN "contactPhone" TEXT;

-- AlterTable: Subscription
ALTER TABLE "Subscription"
  ADD COLUMN "defaultPaymentMethodId" TEXT,
  ADD COLUMN "stripeScheduleId" TEXT,
  ADD COLUMN "pendingUpdate" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Invoice
ALTER TABLE "Invoice"
  ADD COLUMN "amountRemaining" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "subtotal" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "total" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "taxAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "discountAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "number" TEXT,
  ADD COLUMN "orderId" TEXT,
  ADD COLUMN "lines" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "dueDate" TIMESTAMP(3);
CREATE INDEX "Invoice_customerId_createdAt_idx" ON "Invoice"("customerId", "createdAt");

-- AlterTable: Booking (explicit, verified ownership; never inferred from customerEmail)
ALTER TABLE "Booking"
  ADD COLUMN "customerId" TEXT,
  ADD COLUMN "claimedAt" TIMESTAMP(3);
CREATE INDEX "Booking_customerId_idx" ON "Booking"("customerId");

-- CreateTable
CREATE TABLE "CustomerSession" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'PASSWORD',
    "userAgent" TEXT,
    "ipHint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reauthAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "CustomerSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CustomerSession_tokenHash_key" ON "CustomerSession"("tokenHash");
CREATE INDEX "CustomerSession_customerId_revokedAt_idx" ON "CustomerSession"("customerId", "revokedAt");
ALTER TABLE "CustomerSession" ADD CONSTRAINT "CustomerSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "CustomerToken" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CustomerToken_tokenHash_key" ON "CustomerToken"("tokenHash");
CREATE INDEX "CustomerToken_customerId_purpose_idx" ON "CustomerToken"("customerId", "purpose");
ALTER TABLE "CustomerToken" ADD CONSTRAINT "CustomerToken_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "EmailOutbox" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "toEmail" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "dedupeKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailOutbox_dedupeKey_key" ON "EmailOutbox"("dedupeKey");
CREATE INDEX "EmailOutbox_status_nextAttemptAt_idx" ON "EmailOutbox"("status", "nextAttemptAt");
CREATE INDEX "EmailOutbox_customerId_idx" ON "EmailOutbox"("customerId");

-- CreateTable
CREATE TABLE "CustomerCard" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "stripePaymentMethodId" TEXT NOT NULL,
    "brand" TEXT NOT NULL DEFAULT 'card',
    "last4" TEXT NOT NULL DEFAULT '',
    "expMonth" INTEGER NOT NULL DEFAULT 0,
    "expYear" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "detachedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerCard_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CustomerCard_stripePaymentMethodId_key" ON "CustomerCard"("stripePaymentMethodId");
CREATE INDEX "CustomerCard_customerId_detachedAt_idx" ON "CustomerCard"("customerId", "detachedAt");
ALTER TABLE "CustomerCard" ADD CONSTRAINT "CustomerCard_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "CustomerOperation" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'STARTED',
    "request" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerOperation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CustomerOperation_customerId_kind_idempotencyKey_key" ON "CustomerOperation"("customerId", "kind", "idempotencyKey");
CREATE INDEX "CustomerOperation_status_createdAt_idx" ON "CustomerOperation"("status", "createdAt");

-- CreateTable
CREATE TABLE "SubscriptionChange" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "fromSnapshot" JSONB NOT NULL DEFAULT '{}',
    "toSnapshot" JSONB NOT NULL DEFAULT '{}',
    "targetPriceId" TEXT,
    "stripeScheduleId" TEXT,
    "stripeInvoiceId" TEXT,
    "amountDueNow" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "effectiveAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SubscriptionChange_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SubscriptionChange_subscriptionId_status_idx" ON "SubscriptionChange"("subscriptionId", "status");
CREATE INDEX "SubscriptionChange_customerId_idx" ON "SubscriptionChange"("customerId");
ALTER TABLE "SubscriptionChange" ADD CONSTRAINT "SubscriptionChange_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "StripePriceRef" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "stripePriceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StripePriceRef_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StripePriceRef_key_key" ON "StripePriceRef"("key");

-- CreateTable
CREATE TABLE "SupportRequest" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupportRequest_customerId_createdAt_idx" ON "SupportRequest"("customerId", "createdAt");
CREATE INDEX "SupportRequest_status_createdAt_idx" ON "SupportRequest"("status", "createdAt");
