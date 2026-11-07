<!-- Restored from personal repository main on 8 November 2026. -->
> Historical review: the operational statements below were captured on 29 October 2026, not verified as current. Current local validation and environment blockers are recorded in PERFORMANCE_AUDIT.md and RELEASE_VALIDATION.md. No deployment or database mutation is authorized by this document.

# Operations runbook

Reviewed 29 October 2026. STATIC PREPARATION ONLY. API398-case20x is active. This document does not authorize execution, production access, spending, deployment, mail delivery, schema or data changes.

## Safety boundary

Do not start/restart services, build images, migrate/seed/reset, back up current records, restore, run integration/load suites or deploy during the active run. Do not change private env files, application source, schema, migrations, lockfiles or package manifests. Existing README startup examples are not release approval. The runtime image no longer migrates automatically or includes seed tooling.

Future execution requires the run owner to confirm completion/cleanup, named application/DB/on-call owners, an approved window and explicit authorization for each mutating phase. Preserve the Compose project name and named-volume mapping; changing projects can appear to lose data. Never delete volumes to repair startup.

## Configuration contract

- Build context is backend; backend/.dockerignore applies. Private env files, uploads, generated images, common key files and backup artifacts are excluded. The example env file remains allowed. Ignore patterns do not replace secret scanning.
- Compose interpolation uses shell variables or an explicit --env-file backend/.env, not service env_file. Required values now fail closed. Shell values override env-file values. Do not print resolved configuration to shared logs: it contains secrets.
- PostgreSQL receives only POSTGRES_USER, POSTGRES_PASSWORD and POSTGRES_DB, not JWT/admin/SMTP secrets. These initialize a NEW data directory; changing them does not rotate existing users/passwords.
- New required DOCKER_DATABASE_URL must use service hostname postgres, port 5432, the actual database and URI-percent-encoded username/password components, with ?schema=public. Placeholder example: postgresql://APP_USER:ENCODED_PASSWORD@postgres:5432/APP_DB?schema=public. Keep it separate from host-process DATABASE_URL using localhost:5437. Prepare it privately before future full-profile use. No env file was edited. Do not double-encode or use encoded credentials as POSTGRES_PASSWORD. Existing initialized credentials, not merely current env declarations, must match.
- API environment is explicitly allowlisted. JWT_SECRET needs 32+ random characters. FRONTEND_URL and optional FRONTEND_URLS must be exact browser origins; API_ORIGIN controls stored upload URLs. Production requires HTTPS origins and a same-site secure-cookie topology. Application origin validation still permits local HTTP. NODE_ENV=production, PORT=4000, UPLOAD_DIR=/app/uploads and SWAGGER_ENABLED=false are pinned.
- A production runtime DB role should have only required DML privileges; separate migration privileges into a release identity. No roles/grants were created. Current local POSTGRES_USER is not a production least-privilege design.
- SMTP remains empty by default, not forcibly disabled when configured. Leave SMTP_HOST, SMTP_FROM and INQUIRY_TO unset during QA. Setting all three can send real mail for inquiry AND booking submissions. Port 465 uses implicit TLS; 587 uses opportunistic STARTTLS, not enforced requireTLS. Strict STARTTLS/egress needs separately reviewed code/provider policy outside this patch. Approve sender domain, SPF/DKIM/DMARC, credentials, recipients and delivery testing later. SENT means SMTP accepted, not delivered. No durable mail retry queue exists.

## Runtime, networking and storage

The runtime stage contains production dependencies, compiled API and package metadata, runs USER node and starts node directly without npx, migrations or seeds. OpenSSL is installed for Prisma's Alpine engine. Build/release tooling remains in the build stage. npm prune is intended to retain the generated Prisma client; engine loading and production dependency completeness still require a later approved build. Floating node:22-alpine and postgres:17-alpine tags remain unverified. No digest was invented.

API binds on host loopback 127.0.0.1:4000; PostgreSQL remains 127.0.0.1:5437. Loopback is not authentication. Same-host proxying is assumed; a containerized proxy must use private Compose networking, not its own localhost. Do not add public bindings as a shortcut. Production should remove DB host publishing if unnecessary through a reviewed overlay. No TLS proxy, firewall or certificate-renewal infrastructure is supplied here.

The API root filesystem is read-only with dropped capabilities, no privilege escalation, bounded /tmp and a writable durable uploads volume. init forwards signals; shutdown has 30 seconds. API healthcheck uses a bounded GET /api/health whose handler executes SELECT 1. It proves basic API/DB connectivity, not schema parity, SMTP or recovery. pg_isready now uses escaped container POSTGRES_USER/POSTGRES_DB instead of hard-coded wsj. It checks server readiness, not successful application authentication. depends_on only gates initial startup. An unhealthy Docker status alone does not restart a process.

A new image uploads directory is owned by node (official image normally UID/GID 1000). Existing named volumes or bind mounts may retain root/other ownership and fail writes. Do not chown the active volume or introduce root-startup chown. In a later approved window inventory actual UID/GID, preserve verified recovery evidence and approve any targeted ownership repair. Validate upload/read/delete using disposable staging fixtures. Volume copy-up, Docker Desktop permissions and read-only Prisma loading remain untested. Media file and database changes are not atomic; detect orphan/missing files without automated deletion.

## Database, migrations and seeds

Inspected schema and both committed migrations: 202610280001_init and 20261028181512_add_booking. Initial migration creates six tables; later migration adds Booking and BookingStatus. Static tables/enums/indexes correspond to schema, but no live drift/history/checksum verification occurred. No DROP statements were observed. CREATE TABLE/INDEX can lock; test on a representative staging copy and review migration status before release.

Use one explicitly approved release job with pinned release artifact, migration checksums, private migration-role credentials, network access and a named owner. Run migration deploy separately before rollout only after recovery evidence and application/schema compatibility review. Replicas/restarts must not run migrations. Runtime intentionally lacks Prisma CLI and seed sources; use a reviewed build-stage/release artifact, not exec api npm run db:seed or an npx download. Failed migration recovery requires DBA-approved forward repair or isolated recovery, never automatic reset or blind migration resolve.

Seed upserts existing admin/content with empty update objects, preserving existing rows but potentially creating new ones. It is not harmless validation. Its cwd-relative ../data/migration-content.json is outside the backend-only image context: a container seed could create an admin but silently skip content. No implicit seed/import release task is acceptable. Review source artifacts, checksums, expected counts, kind+slug duplicates and CMS-edit preservation first. No counts or data were queried here.

Future schema/source readiness gaps: publication rules are application-enforced JSON; PopupEvent.popupId, Audit.actorId and Booking.serviceId lack foreign keys. Booking monetary fields are floating point; the public route stores client-supplied totals. Stripe-named columns are not payment integration. This review proves no reservation, trusted price calculation, inventory, charge or refund capability. Do not enable paid booking without separate business/security approval.

## Backup/restore design, NOT executed

No backup command ran. Approve RPO/RTO, retention, residency, recovery owner, encryption/key ownership, storage provider and budget. Back up both PostgreSQL and uploads. Proposed design: quiesce writes in an approved window or use coordinated snapshots, capture a consistent PostgreSQL logical archive plus required roles/grants and matching uploads snapshot, record release/migration versions and checksums, encrypt and copy off-host. Use PostgreSQL 17-compatible tools. Long dump snapshots can affect vacuum/storage.

Use approved private credential injection; no passwords in history/logs. Backups contain PII/password hashes and must never enter repository, image context or shared QA evidence. Review immutable/offline retention, least privilege, legal holds, deletion and key recovery. WAL/PITR requires separately approved archive/managed-service configuration; none exists in Compose.

Restore drills must target an isolated empty database and separate uploads storage, with outbound SMTP/payment blocked and sanitized credentials. Verify checksums, restore roles/schema/data, reconcile Media rows/files, check counts/constraints/migration state, and validate compatible application auth/content/media using approved fixtures. Record measured recovery time/data loss. A successful dump is not a restore test. Never overwrite the active database or volume. Recovery capability is [blocked] until evidence exists.

## SRE, support, supply chain and costs

Throttler uses single-process memory and proxy trust is not configured. Behind a proxy, callers may share the proxy IP. Never trust arbitrary X-Forwarded-For. Stay single-instance until reviewed shared storage and narrowly trusted proxies are implemented/tested; no autoscaling approval is implied. Multiple replicas also need shared uploads design.

Approve alerts for API latency/failures/429, DB connections/locks/query latency/disk/WAL, upload capacity and failed/overdue mail/backups/restores. Exclude customer PII/tokens from logs. Docker logs now rotate at 10m x 3 per service. This limits local log files only, not central ingestion costs or durable audit retention. Audit/PopupEvent/Inquiry/Booking lack an approved retention job; no records were deleted.

No capacity/load evidence exists. Approve CPU/memory/process limits, Prisma per-instance connection budgets, storage/egress/log budgets, spend alerts and ownership from measurements before scaling. No speculative hard resource limit was imposed. Database, volumes, backups, registry and monitoring cost controls are not established by Compose. No resource was bought/provisioned.

npm ci uses existing lockfiles, and runtime omits dev tooling. Digest pinning, SBOM, provenance/signature verification, vulnerability scanning and verified base-image/Prisma compatibility remain release gates; no install, registry lookup or audit was executed. Pick verified digests through the approved update process rather than guessing them.

Support: capture timestamp/release and redacted symptoms, inspect approved health/log evidence, storage permissions and DB capacity before restart. Never repair incidents with seed/reset/volume deletion. SMTP failures may leave persisted submissions; do not request blind customer resubmission. Rolling back an image does not roll back schema. Prefer reviewed forward repair; restoring old data can lose later writes and needs incident authorization.

## Validation and deferred acceptance

Only run the exact offline test file, never backend's wildcard test suite: node --experimental-strip-types --test backend/test/operations-review.test.ts from repo root. It reads config using the existing local YAML parser, without application imports, network, Docker or DB access. Later Compose CLI validation must use synthetic placeholders or quiet validation without exposing secrets; no Docker command was run here.

[blocked] Image build/startup, Prisma engine compatibility, migrations, uploads permissions, TLS/cookies/proxy behavior, secret rotation, shared throttling, SMTP delivery, vulnerability checks, resource sizing and backup/restore remain unverified. Require isolated staging and explicit approval after API398-case20x completion. This is not production acceptance or release authorization.
