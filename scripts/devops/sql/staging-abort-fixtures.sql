-- ============================================================================
-- STAGING ONLY: values that pass the backfill's original '^\d{4}-\d{2}-\d{2}' regex
-- but cannot be cast, plus a non-finite booking amount. Used to prove how the
-- migration behaves (abort vs. tolerate) on data that legacy imports could contain.
-- ============================================================================
\set ON_ERROR_STOP on
DO $$ BEGIN
  IF current_database() !~ '^wsj_(staging|drill|restore)' THEN
    RAISE EXCEPTION 'staging-abort-fixtures.sql refused: % is not a staging database', current_database();
  END IF;
END $$;

INSERT INTO "Content"(id, kind, title, slug, status, metadata, "updatedAt") VALUES
 ('fx-21','blog','FX Feb 30','fx-feb-30','PUBLISHED','{"publishAt":"2026-02-30T00:00:00Z"}',now()),
 ('fx-22','blog','FX hour 25','fx-hour-25','PUBLISHED','{"publishAt":"2026-11-01T25:00:00Z"}',now()),
 ('fx-23','blog','FX year 0000','fx-year-zero','PUBLISHED','{"publishAt":"0000-01-01T00:00:00Z"}',now());

INSERT INTO "Booking"(id, "serviceType", "serviceName", "customerName", "customerEmail", "subtotalPrice", "totalPrice", "updatedAt") VALUES
 ('fxb-07','fixture','FX NaN','Fixture','fixture@example.invalid','NaN'::float8,'NaN'::float8,now());
