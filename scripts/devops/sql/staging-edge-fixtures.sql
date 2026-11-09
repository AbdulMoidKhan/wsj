-- ============================================================================
-- STAGING ONLY: synthetic edge-case rows used to prove migration
-- 20261109000000_performance_audit_indexes. Production data (2026-11-09) has no
-- publishAt/startsAt/endsAt/enabled keys and only whole-dollar bookings, so these
-- rows exercise the paths production data cannot.
-- Refuses to run unless the database name starts with wsj_staging / wsj_drill / wsj_restore.
-- ============================================================================
\set ON_ERROR_STOP on
DO $$ BEGIN
  IF current_database() !~ '^wsj_(staging|drill|restore)' THEN
    RAISE EXCEPTION 'staging-edge-fixtures.sql refused: % is not a staging database', current_database();
  END IF;
END $$;

INSERT INTO "Content"(id, kind, title, slug, status, metadata, "updatedAt") VALUES
 ('fx-01','blog','FX past Z','fx-past-z','PUBLISHED','{"publishAt":"2026-11-01T10:00:00Z"}',now()),
 ('fx-02','blog','FX future +05','fx-future-offset','PUBLISHED','{"publishAt":"2027-01-01T00:00:00+05:00"}',now()),
 ('fx-03','blog','FX -05 crosses UTC day','fx-offset-day','PUBLISHED','{"publishAt":"2026-11-01T23:30:00-05:00"}',now()),
 ('fx-04','blog','FX no offset (legacy)','fx-no-offset','PUBLISHED','{"publishAt":"2026-11-01T10:00:00"}',now()),
 ('fx-05','blog','FX date only (legacy)','fx-date-only','PUBLISHED','{"publishAt":"2026-11-01"}',now()),
 ('fx-06','blog','FX microseconds','fx-micro','PUBLISHED','{"publishAt":"2026-11-01T10:00:00.123456Z"}',now()),
 ('fx-07','blog','FX json null','fx-json-null','PUBLISHED','{"publishAt":null}',now()),
 ('fx-08','blog','FX numeric publishAt','fx-number','PUBLISHED','{"publishAt":1730000000000}',now()),
 ('fx-09','blog','FX unparseable text','fx-garbage','PUBLISHED','{"publishAt":"tomorrow"}',now()),
 ('fx-10','services','FX enabled=false','fx-disabled-bool','PUBLISHED','{"enabled":false}',now()),
 ('fx-11','services','FX enabled="false" string','fx-disabled-string','PUBLISHED','{"enabled":"false"}',now()),
 ('fx-12','services','FX enabled=true','fx-enabled-true','PUBLISHED','{"enabled":true}',now()),
 ('fx-13','pricing','FX requiresReview="true" string','fx-review-string','PUBLISHED','{"requiresReview":"true"}',now()),
 ('fx-14','popups','FX popup active','fx-popup-active','PUBLISHED','{"startsAt":"2026-11-01T00:00:00Z","endsAt":"2027-11-01T00:00:00Z"}',now()),
 ('fx-15','popups','FX popup expired','fx-popup-expired','PUBLISHED','{"startsAt":"2026-01-01T00:00:00Z","endsAt":"2026-02-01T00:00:00Z"}',now()),
 ('fx-16','popups','FX popup future','fx-popup-future','PUBLISHED','{"startsAt":"2027-01-01T00:00:00Z"}',now()),
 ('fx-17','blog','FX draft scheduled','fx-draft','DRAFT','{"publishAt":"2027-01-01T00:00:00Z"}',now()),
 ('fx-18','blog','FX metadata JSON null','fx-meta-null','PUBLISHED','null',now()),
 ('fx-19','blog','FX metadata array','fx-meta-array','PUBLISHED','[]',now()),
 ('fx-20','blog','FX metadata scalar','fx-meta-scalar','PUBLISHED','"x"',now());

INSERT INTO "Booking"(id, "serviceType", "serviceName", "customerName", "customerEmail", "subtotalPrice", "totalPrice", "updatedAt") VALUES
 ('fxb-01','fixture','FX half cent','Fixture','fixture@example.invalid',10.005,10.005,now()),
 ('fxb-02','fixture','FX binary 0.285','Fixture','fixture@example.invalid',0.285,0.285,now()),
 ('fxb-03','fixture','FX 19.99 / 21.59','Fixture','fixture@example.invalid',19.99,21.59,now()),
 ('fxb-04','fixture','FX large','Fixture','fixture@example.invalid',99999.99,107999.99,now()),
 ('fxb-05','fixture','FX zero','Fixture','fixture@example.invalid',0,0,now()),
 ('fxb-06','fixture','FX 0.1+0.2','Fixture','fixture@example.invalid',0.1::float8+0.2::float8,0.30000000000000004,now());
