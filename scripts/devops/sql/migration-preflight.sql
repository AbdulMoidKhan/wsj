-- ============================================================================
-- READ-ONLY preflight for release/performance-security-20261109
-- (single pending migration: 20261109000000_performance_audit_indexes). SELECT only.
--
--   docker exec -i wsj-app-postgres-1 psql -U wsj -d wsj -X -At -F '|' -v ON_ERROR_STOP=1 \
--     < scripts/devops/sql/migration-preflight.sql
--
-- Rows: check|value|expected|PASS/FAIL. Last check row: PREFLIGHT|<n> failures|0|PASS/FAIL.
-- Any FAIL is a STOP condition for the production migration.
-- ============================================================================
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;

WITH expected_applied AS (
  SELECT unnest(ARRAY['202610280001_init','20261028181512_add_booking','20261105145044_add_billing_subscriptions','20261108090000_add_dynamic_service_catalog']) AS name
), sched AS (
  SELECT c.id, k.key, c.metadata->k.key AS v
  FROM "Content" c CROSS JOIN (VALUES ('publishAt'),('startsAt'),('endsAt')) AS k(key)
  WHERE jsonb_typeof(c.metadata) = 'object' AND c.metadata ? k.key
    AND c.metadata->k.key NOT IN ('null'::jsonb, 'false'::jsonb, '0'::jsonb, '""'::jsonb)
), pf AS (
SELECT 'applied_migrations_expected' AS chk,
       (SELECT count(*) FROM _prisma_migrations m JOIN expected_applied e ON e.name = m.migration_name WHERE m.finished_at IS NOT NULL AND m.rolled_back_at IS NULL)::text AS val, '4' AS expected
UNION ALL SELECT 'total_migration_records', (SELECT count(*) FROM _prisma_migrations)::text, '4'
UNION ALL SELECT 'unfinished_or_failed_migrations', (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL)::text, '0'
UNION ALL SELECT 'release_columns_already_present',
       (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND
         ((table_name='Content' AND column_name IN ('publishAt','startsAt','endsAt','enabled','requiresReview'))
          OR (table_name='Booking' AND column_name IN ('subtotalPriceCents','totalPriceCents'))))::text, '0'
UNION ALL SELECT 'release_trigger_or_functions_present',
       (SELECT count(*) FROM pg_proc WHERE proname IN ('content_schedule_sync','content_schedule_value'))::text, '0'
UNION ALL SELECT 'content_schedule_values_unparseable (stay hidden, as today)',
       (SELECT count(*) FROM sched WHERE jsonb_typeof(v) <> 'string' OR (v #>> '{}') !~ '^\d{4}-\d{2}-\d{2}' OR NOT pg_input_is_valid(v #>> '{}', 'timestamptz'))::text, '0'
UNION ALL SELECT 'content_schedule_values_without_explicit_offset',
       (SELECT count(*) FROM sched WHERE jsonb_typeof(v) = 'string' AND (v #>> '{}') !~ '(Z|[+-]\d{2}:\d{2})$')::text, '0'
UNION ALL SELECT 'content_enabled_or_review_not_boolean',
       (SELECT count(*) FROM "Content" WHERE jsonb_typeof(metadata) = 'object' AND
         ((metadata ? 'enabled' AND jsonb_typeof(metadata->'enabled') NOT IN ('boolean','null')) OR
          (metadata ? 'requiresReview' AND jsonb_typeof(metadata->'requiresReview') NOT IN ('boolean','null'))))::text, '0'
UNION ALL SELECT 'booking_amounts_non_finite',
       (SELECT count(*) FROM "Booking" WHERE "subtotalPrice" IN ('NaN'::float8,'Infinity'::float8,'-Infinity'::float8) OR "totalPrice" IN ('NaN'::float8,'Infinity'::float8,'-Infinity'::float8))::text, '0'
UNION ALL SELECT 'booking_amounts_not_whole_cents',
       (SELECT count(*) FROM "Booking" WHERE "subtotalPrice" NOT IN ('NaN'::float8,'Infinity'::float8,'-Infinity'::float8) AND "totalPrice" NOT IN ('NaN'::float8,'Infinity'::float8,'-Infinity'::float8)
          AND ("subtotalPrice"::numeric <> round("subtotalPrice"::numeric, 2) OR "totalPrice"::numeric <> round("totalPrice"::numeric, 2)))::text, '0'
UNION ALL SELECT 'booking_amounts_out_of_int_cents_range',
       (SELECT count(*) FROM "Booking" WHERE abs("subtotalPrice") >= 21474836 OR abs("totalPrice") >= 21474836)::text, '0'
UNION ALL SELECT 'transactions_open_longer_than_5s',
       (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid()
          AND xact_start IS NOT NULL AND now() - xact_start > interval '5 seconds')::text, '0'
UNION ALL SELECT 'locks_waiting', (SELECT count(*) FROM pg_locks WHERE NOT granted)::text, '0'
UNION ALL SELECT 'server_version_num_ge_160000 (pg_input_is_valid)', (current_setting('server_version_num')::int >= 160000)::text, 'true'
UNION ALL SELECT 'session_timezone', current_setting('TimeZone'), 'UTC'
)
SELECT chk, val, expected, CASE WHEN val = expected THEN 'PASS' ELSE 'FAIL' END FROM pf
UNION ALL
SELECT 'PREFLIGHT', count(*) FILTER (WHERE val IS DISTINCT FROM expected) || ' failures', '0',
       CASE WHEN count(*) FILTER (WHERE val IS DISTINCT FROM expected) = 0 THEN 'PASS' ELSE 'FAIL' END FROM pf;

SELECT 'rows_' || relname, n_live_tup::text, '-', 'INFO' FROM pg_stat_user_tables WHERE relname IN ('Content','Booking','Order','Subscription','Inquiry','PopupEvent','Customer') ORDER BY relname;
ROLLBACK;
