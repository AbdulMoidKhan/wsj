// WSJ-02 guard: a package CTA preselects its package only when the name is unambiguous.
import test from 'node:test';
import assert from 'node:assert/strict';
import {findPlanHint, findCatalogServiceHint} from '../../lib/catalog-service-hint.ts';

const plans = [
  {slug: 'coworking-bronze', name: 'Bronze'},
  {slug: 'coworking-silver', name: 'Silver'},
  {slug: 'starter-1', name: 'Starter Podcast Session'},
  {slug: 'starter-2', name: 'Starter Podcast Session'},
];
const services = [{slug: 'coworking', name: 'Coworking'}, {slug: 'podcast-studio', name: 'Podcast Studio'}];

test('"Service - Package" selects the service and the unique package', () => {
  assert.equal(findCatalogServiceHint(services, 'coworking - Bronze')?.slug, 'coworking');
  assert.equal(findPlanHint(plans, 'coworking - Bronze')?.slug, 'coworking-bronze');
  assert.equal(findPlanHint(plans, 'Coworking – silver')?.slug, 'coworking-silver');
});
test('bare package name or slug selects it', () => {
  assert.equal(findPlanHint(plans, 'Bronze')?.slug, 'coworking-bronze');
  assert.equal(findPlanHint(plans, 'coworking-silver')?.slug, 'coworking-silver');
});
test('ambiguous, partial or unknown names leave the choice to the customer', () => {
  assert.equal(findPlanHint(plans, 'Podcast Studio - Starter Podcast Session'), undefined);
  assert.equal(findPlanHint(plans, 'Bron'), undefined);
  assert.equal(findPlanHint(plans, 'Gold'), undefined);
  assert.equal(findPlanHint(plans, ''), undefined);
  assert.equal(findPlanHint(plans, undefined), undefined);
});
