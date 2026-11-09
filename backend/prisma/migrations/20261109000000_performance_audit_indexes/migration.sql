-- Performance/security audit remediation: F-003, F-004, F-007, F-008, F-009, F-014
-- Expand-only. Adds indexes, defaulted/nullable columns and one trigger; existing columns
-- (Content.metadata, Booking.subtotalPrice/totalPrice) and their values are never modified,
-- so the previous application release keeps working against this schema.
--
-- Prisma applies this file in ONE transaction. Content, Booking, Order and Subscription are
-- held under ACCESS EXCLUSIVE until commit (sub-second at production size). The lock timeout
-- makes the migration FAIL FAST instead of queueing every request behind a blocked
-- ACCESS EXCLUSIVE request when a long-running query already holds a lock.
SELECT set_config('lock_timeout', '5s', true);
SELECT set_config('statement_timeout', '120s', true);

-- F-009: Composite index on Content covering kind, status, sortOrder, and createdAt
DROP INDEX IF EXISTS "Content_kind_status_sortOrder_idx";
CREATE INDEX IF NOT EXISTS "Content_kind_status_sortOrder_createdAt_idx" ON "Content"("kind", "status", "sortOrder", "createdAt" DESC);

-- F-003: SQL scheduling columns used by the public API for eligibility filtering and pagination.
ALTER TABLE "Content"
  ADD COLUMN IF NOT EXISTS "publishAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "startsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "endsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "requiresReview" BOOLEAN NOT NULL DEFAULT false;

-- metadata stays the editable source of truth in this release (admin UI, imports, seeds and the
-- previous release all write metadata). This trigger derives the columns on EVERY insert/update,
-- so they can never drift, whoever writes the row. It reproduces contentEligible() in
-- backend/src/content-safety.ts exactly:
--   * a schedule value counts as "present" when it is JS-truthy (not absent/null/false/0/"");
--   * an ISO-shaped string PostgreSQL can parse is stored as its UTC instant;
--   * a present but unparseable value hides the row, as the application does today:
--     publishAt/startsAt -> 9999-12-31 (never reached), endsAt -> 1970-01-01 (already over);
--   * absent values are NULL (no constraint);
--   * enabled = false only for JSON boolean false    (app: m.enabled === false)
--   * requiresReview = true only for JSON boolean true (app: m.requiresReview === true)
-- pg_input_is_valid (PostgreSQL 16+) means a bad value can never abort a write or this migration.
CREATE OR REPLACE FUNCTION "content_schedule_value"(v jsonb, unparseable timestamp) RETURNS timestamp
LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN v IS NULL OR v IN ('null'::jsonb, 'false'::jsonb, '0'::jsonb, '""'::jsonb) THEN NULL
    WHEN jsonb_typeof(v) = 'string' AND (v #>> '{}') ~ '^\d{4}-\d{2}-\d{2}'
         AND pg_input_is_valid(v #>> '{}', 'timestamptz')
      THEN ((v #>> '{}')::timestamptz AT TIME ZONE 'UTC')::timestamp(3)
    ELSE unparseable
  END
$$;
CREATE OR REPLACE FUNCTION "content_schedule_sync"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE m jsonb := CASE WHEN jsonb_typeof(NEW.metadata) = 'object' THEN NEW.metadata ELSE '{}'::jsonb END;
BEGIN
  NEW."publishAt" := "content_schedule_value"(m->'publishAt', '9999-12-31 23:59:59.999');
  NEW."startsAt"  := "content_schedule_value"(m->'startsAt',  '9999-12-31 23:59:59.999');
  NEW."endsAt"    := "content_schedule_value"(m->'endsAt',    '1970-01-01 00:00:00');
  NEW."enabled" := NOT COALESCE(m->'enabled' = 'false'::jsonb, false);
  NEW."requiresReview" := COALESCE(m->'requiresReview' = 'true'::jsonb, false);
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS "content_schedule_sync" ON "Content";
CREATE TRIGGER "content_schedule_sync" BEFORE INSERT OR UPDATE ON "Content"
  FOR EACH ROW EXECUTE FUNCTION "content_schedule_sync"();

-- Backfill existing rows through the same trigger (metadata itself is unchanged; updatedAt is
-- maintained by Prisma, not the database, so it is unchanged as well).
UPDATE "Content" SET "metadata" = "metadata";

CREATE INDEX IF NOT EXISTS "Content_kind_status_publishAt_idx" ON "Content"("kind", "status", "publishAt");

-- F-008: Admin index on Inquiry for status and chronological sorting
CREATE INDEX IF NOT EXISTS "Inquiry_status_createdAt_idx" ON "Inquiry"("status", "createdAt" DESC);

-- F-008: Admin index on PopupEvent for chronological sorting
CREATE INDEX IF NOT EXISTS "PopupEvent_createdAt_idx" ON "PopupEvent"("createdAt" DESC);

-- F-004: Payment Intent lookup index on Order for Stripe webhook processing
CREATE INDEX IF NOT EXISTS "Order_stripePaymentIntentId_idx" ON "Order"("stripePaymentIntentId");

-- F-007: Relational indexes on Subscription for Stripe customer sync and order linkage
CREATE INDEX IF NOT EXISTS "Subscription_stripeCustomerId_idx" ON "Subscription"("stripeCustomerId");
CREATE INDEX IF NOT EXISTS "Subscription_orderId_idx" ON "Subscription"("orderId");

-- F-014: Expand-and-contract integer cents columns for Booking. The Float columns stay
-- authoritative in this release. Non-finite amounts stay NULL instead of aborting the migration;
-- amounts that are not whole cents (none in production on 2026-11-09) are flagged by
-- scripts/devops/sql/migration-preflight.sql for manual review.
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "subtotalPriceCents" INTEGER, ADD COLUMN IF NOT EXISTS "totalPriceCents" INTEGER;
UPDATE "Booking" SET "subtotalPriceCents" = ROUND("subtotalPrice"::numeric * 100)::INTEGER
  WHERE "subtotalPriceCents" IS NULL AND "subtotalPrice" NOT IN ('NaN'::float8, 'Infinity'::float8, '-Infinity'::float8);
UPDATE "Booking" SET "totalPriceCents" = ROUND("totalPrice"::numeric * 100)::INTEGER
  WHERE "totalPriceCents" IS NULL AND "totalPrice" NOT IN ('NaN'::float8, 'Infinity'::float8, '-Infinity'::float8);
