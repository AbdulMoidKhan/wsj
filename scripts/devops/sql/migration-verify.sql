-- ============================================================================
-- READ-ONLY post-migration verification for release/performance-security-20261109. SELECT only.
--
--   docker exec -i wsj-app-postgres-1 psql -U wsj -d wsj -X -At -F '|' -v ON_ERROR_STOP=1 \
--     < scripts/devops/sql/migration-verify.sql
--
-- Pair with scripts/devops/migration-reconcile.cjs (application-level parity).
-- Any FAIL is a STOP condition: do not start the new application release.
-- ============================================================================
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;

WITH expected_mirror AS (
  -- Independent re-statement of the trigger rules (not a call to the trigger function).
  SELECT c.id,
    CASE WHEN jsonb_typeof(c.metadata) <> 'object' OR NOT (c.metadata ? 'publishAt') OR c.metadata->'publishAt' IN ('null'::jsonb,'false'::jsonb,'0'::jsonb,'""'::jsonb) THEN NULL
         WHEN jsonb_typeof(c.metadata->'publishAt')='string' AND (c.metadata->>'publishAt') ~ '^\d{4}-\d{2}-\d{2}' AND pg_input_is_valid(c.metadata->>'publishAt','timestamptz')
           THEN ((c.metadata->>'publishAt')::timestamptz AT TIME ZONE 'UTC')::timestamp(3)
         ELSE timestamp '9999-12-31 23:59:59.999' END AS p,
    CASE WHEN jsonb_typeof(c.metadata) <> 'object' OR NOT (c.metadata ? 'endsAt') OR c.metadata->'endsAt' IN ('null'::jsonb,'false'::jsonb,'0'::jsonb,'""'::jsonb) THEN NULL
         WHEN jsonb_typeof(c.metadata->'endsAt')='string' AND (c.metadata->>'endsAt') ~ '^\d{4}-\d{2}-\d{2}' AND pg_input_is_valid(c.metadata->>'endsAt','timestamptz')
           THEN ((c.metadata->>'endsAt')::timestamptz AT TIME ZONE 'UTC')::timestamp(3)
         ELSE timestamp '1970-01-01 00:00:00' END AS e,
    NOT COALESCE(CASE WHEN jsonb_typeof(c.metadata)='object' THEN c.metadata->'enabled' = 'false'::jsonb END, false) AS en,
    COALESCE(CASE WHEN jsonb_typeof(c.metadata)='object' THEN c.metadata->'requiresReview' = 'true'::jsonb END, false) AS rr
  FROM "Content" c
), v AS (
SELECT 'release_migration_applied' AS chk,
       (SELECT count(*) FROM _prisma_migrations WHERE migration_name = '20261109000000_performance_audit_indexes' AND finished_at IS NOT NULL AND rolled_back_at IS NULL)::text AS val, '1' AS expected
UNION ALL SELECT 'total_applied_migrations', (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)::text, '5'
UNION ALL SELECT 'failed_migration_records', (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL)::text, '0'
UNION ALL SELECT 'direct_payments_NOT_applied', (SELECT count(*) FROM _prisma_migrations WHERE migration_name = '20261108000000_direct_payments')::text, '0'
UNION ALL SELECT 'direct_payments_columns_absent',
       (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND
         ((table_name='Order' AND column_name IN ('checkoutTokenHash','idempotencyKey','requestFingerprint','autoRenew','recurringConsentAt','stripeDirectSubscriptionId','providerProcessing'))
          OR (table_name='Subscription' AND column_name IN ('autoRenew','recurringConsentAt','paidThrough','finiteOrderItemId'))))::text, '0'
UNION ALL SELECT 'new_columns_present',
       (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND
         ((table_name='Content' AND column_name IN ('publishAt','startsAt','endsAt','enabled','requiresReview'))
          OR (table_name='Booking' AND column_name IN ('subtotalPriceCents','totalPriceCents'))))::text, '7'
UNION ALL SELECT 'subscription_stripeSubscriptionId_still_required', (SELECT is_nullable FROM information_schema.columns WHERE table_name='Subscription' AND column_name='stripeSubscriptionId'), 'NO'
UNION ALL SELECT 'trigger_enabled', (SELECT count(*) FROM pg_trigger WHERE tgname='content_schedule_sync' AND tgenabled='O')::text, '1'
UNION ALL SELECT 'expected_indexes_valid',
       (SELECT count(*) FROM pg_index i JOIN pg_class x ON x.oid = i.indexrelid
         WHERE x.relname IN ('Content_kind_status_sortOrder_createdAt_idx','Content_kind_status_publishAt_idx','Inquiry_status_createdAt_idx',
                             'PopupEvent_createdAt_idx','Order_stripePaymentIntentId_idx','Subscription_stripeCustomerId_idx','Subscription_orderId_idx')
           AND i.indisvalid AND i.indisready)::text, '7'
UNION ALL SELECT 'old_content_index_dropped', (SELECT count(*) FROM pg_indexes WHERE indexname = 'Content_kind_status_sortOrder_idx')::text, '0'
UNION ALL SELECT 'invalid_indexes_total', (SELECT count(*) FROM pg_index WHERE NOT (indisvalid AND indisready))::text, '0'
UNION ALL SELECT 'content_publishAt_mirror_mismatch', (SELECT count(*) FROM "Content" c JOIN expected_mirror m USING (id) WHERE c."publishAt" IS DISTINCT FROM m.p)::text, '0'
UNION ALL SELECT 'content_endsAt_mirror_mismatch', (SELECT count(*) FROM "Content" c JOIN expected_mirror m USING (id) WHERE c."endsAt" IS DISTINCT FROM m.e)::text, '0'
UNION ALL SELECT 'content_enabled_mirror_mismatch', (SELECT count(*) FROM "Content" c JOIN expected_mirror m USING (id) WHERE c.enabled IS DISTINCT FROM m.en)::text, '0'
UNION ALL SELECT 'content_requiresReview_mirror_mismatch', (SELECT count(*) FROM "Content" c JOIN expected_mirror m USING (id) WHERE c."requiresReview" IS DISTINCT FROM m.rr)::text, '0'
UNION ALL SELECT 'booking_cents_null', (SELECT count(*) FROM "Booking" WHERE "subtotalPriceCents" IS NULL OR "totalPriceCents" IS NULL)::text, '0'
UNION ALL SELECT 'booking_cents_mismatch_rows',
       (SELECT count(*) FROM "Booking" WHERE "totalPriceCents" <> ROUND("totalPrice"::numeric * 100) OR "subtotalPriceCents" <> ROUND("subtotalPrice"::numeric * 100))::text, '0'
UNION ALL SELECT 'booking_total_cents_reconciles',
       (SELECT (COALESCE(sum("totalPriceCents"),0) = COALESCE(ROUND(sum("totalPrice"::numeric) * 100),0))::text FROM "Booking"), 'true'
)
SELECT chk, val, expected, CASE WHEN val = expected THEN 'PASS' ELSE 'FAIL' END FROM v
UNION ALL
SELECT 'VERIFY', count(*) FILTER (WHERE val IS DISTINCT FROM expected) || ' failures', '0',
       CASE WHEN count(*) FILTER (WHERE val IS DISTINCT FROM expected) = 0 THEN 'PASS' ELSE 'FAIL' END FROM v;
SELECT 'rows_' || relname, n_live_tup::text, '-', 'INFO' FROM pg_stat_user_tables WHERE relname IN ('Content','Booking','Order','Subscription','Inquiry','PopupEvent','Customer') ORDER BY relname;
SELECT 'booking_totals', count(*)::text || ' rows / ' || COALESCE(sum("totalPriceCents"),0)::text || ' cents / ' || COALESCE(round(sum("totalPrice")::numeric,2),0)::text || ' float', '-', 'INFO' FROM "Booking";
ROLLBACK;
