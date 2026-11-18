'use strict';
// Single-process offline release checks. Deliberately excludes api.test.ts,
// mutation suites, real providers and all environment-file loading.
require('./pure-regressions.cjs');
require('./performance-optimizations.test.cjs');
for (const file of [
 '../../backend/test/billing-core.test.ts',
 '../../backend/test/billing-subscription.test.ts',
 '../../backend/test/catalog-core.test.ts',
 '../../backend/test/origins.test.ts',
 '../../backend/test/safety.test.ts',
 './service-intent.test.cjs',
 './frontend-safety.test.ts',
 './service-content.test.ts',
 '../../backend/test/public-cache-performance.test.ts',
 '../../backend/test/catalog-checkout-regressions.test.ts',
 '../../backend/test/catalog-billing-lifecycle.test.ts',
]) require(file);
