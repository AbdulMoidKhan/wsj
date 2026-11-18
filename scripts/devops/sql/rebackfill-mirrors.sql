-- ============================================================================
-- Idempotent re-derivation of the DERIVED columns added by 20261109000000_performance_audit_indexes.
--   Content: re-fires the content_schedule_sync trigger (metadata itself is unchanged).
--   Booking: fills subtotalPriceCents/totalPriceCents only where still NULL.
-- Never touches metadata, prices (Float columns) or any other customer data.
--
-- Normally NOT needed: the trigger keeps Content columns in sync for every writer, including
-- the previous release after an application rollback. Use it only if the trigger was disabled,
-- or after an app rollback for bookings created without cents. Requires the same production
-- authorization as a migration.
--
--   docker exec -i wsj-app-postgres-1 psql -U wsj -d wsj -X -v ON_ERROR_STOP=1 \
--     < scripts/devops/sql/rebackfill-mirrors.sql
-- Then run migration-verify.sql (must print VERIFY|0 failures|0|PASS).
-- ============================================================================
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
UPDATE "Content" SET "metadata" = "metadata";
UPDATE "Booking" SET "subtotalPriceCents" = ROUND("subtotalPrice"::numeric * 100)::INTEGER
  WHERE "subtotalPriceCents" IS NULL AND "subtotalPrice" NOT IN ('NaN'::float8, 'Infinity'::float8, '-Infinity'::float8);
UPDATE "Booking" SET "totalPriceCents" = ROUND("totalPrice"::numeric * 100)::INTEGER
  WHERE "totalPriceCents" IS NULL AND "totalPrice" NOT IN ('NaN'::float8, 'Infinity'::float8, '-Infinity'::float8);
COMMIT;