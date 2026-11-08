# Live deployment: 8 November 2026

Live site: **https://wp.workspacejunction.com/**

Target: Hostinger VPS **72.61.0.11**, existing Workspace Junction app only.

## Published and deployed

- Application release: `81ea02baeefb3d82630ed31ec01cda4b0d77092a` on personal `AbdulMoidKhan/wsj` main.
- Preserved the prior production Git history instead of discarding its commits. Existing order-inspector typing fixes were already present; the coworking same-day calendar restriction was retained explicitly.
- Frontend and NestJS backend built successfully on the VPS. The frontend generated 183 static pages while retaining intended dynamic routes.
- Built the frontend in an isolated directory and swapped the completed build, then restarted only `wsj-web` and `wsj-backend`. Both are online with `NODE_ENV=production`.
- Kept existing installed dependencies because both dependency lockfiles were unchanged. No global Node, Nginx, DNS, hosting plan, database server or unrelated application was changed.
- Production Git origin now follows the personal repository. Subsequent report-only commits do not change the built application code.

## Database and recovery

- Prepared a private PostgreSQL recovery dump and validated its archive listing before migration. Retained private before/current data snapshots on the VPS; no database records or secrets were uploaded to GitHub.
- Applied only `20261108090000_add_dynamic_service_catalog`. Prisma reports all four migrations up to date.
- Initialized only the new empty catalog tables: **13 services, 25 packages, 24 add-ons, 26 amenities**. Existing users, customers, orders, bookings, CMS content and legacy plans were not reseeded.
- Existing record counts did not decrease. A later pending checkout appeared during the deployment window and was preserved rather than deleted or replayed.
- Removed six verified stale application backup directories and superseded build/configuration copies, leaving one current application build and small private database recovery snapshots.

## Stripe configuration

- The existing live Stripe key was retained. Created a dedicated production webhook for `https://wp.workspacejunction.com/api/webhooks/stripe`, enabled for the 12 implemented checkout/subscription/invoice event types.
- Stored the returned signing secret privately in the backend environment and app process environment; it was never printed or committed. All other existing environment values were preserved.
- Verified a signed synthetic non-payment event returns **200**, while an unsigned event returns **400**. The Stripe endpoint is enabled in live mode.
- No real charge, refund, checkout submission or email delivery was performed by the deployment verification. This is not a claim that an actual customer payment was tested.

## Verification

- **219 offline tests passed**, plus lint and frontend TypeScript checks before publication. Both production builds and Prisma checks passed.
- HTTPS 200 checks: home, coworking, dedicated desks, podcast studio, meeting rooms, memberships, use cases, services, contact, admin and account pages.
- API/database readiness: **200**; public catalog: **200**, source `CATALOG`, 13 services.
- Existing administrator login: **201**; authenticated catalog management: **200**; unauthenticated admin access: **401**. Credentials and tokens were not printed.
- Server-side quote checks: two studio hours plus zero optional extension = 15,000 cents; plus one independently selected extension = 22,000 cents. Client-supplied prices and legacy catalog-price bypasses returned **400**.
- The live Plans & Pricing button opens the catalog popup without navigating to `#pricing`. Service selection, package selection and server-confirmed recurring pricing were inspected. A 390x844 viewport had no horizontal overflow.
- An initial final-status reporting command had a syntax error and triggered the automatic application rollback. The diagnostic was corrected; the subsequent deployment and all final checks passed. No database rollback or removal of existing records occurred.

## Configuration limits, not invented functionality

- Events, workshops, webinars and memberships have no priced packages in the reviewed catalog seed. They remain inquiry/request flows until business-approved rates are configured through the admin catalog. No prices were invented or copied blindly from older records.
- SMTP remains unconfigured. Inquiry records can be received, but email delivery and email-based account flows require the production SMTP configuration. No SMTP credentials were fabricated.
- Field Core Web Vitals, a real payment/refund, external mail delivery and full backup-restore recovery were not asserted. The root domain `workspacejunction.com` was not moved; this deployment uses the existing VPS subdomain above.
