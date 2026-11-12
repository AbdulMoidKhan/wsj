/**
 * LOCAL test users for the customer account area. Never imported by the application.
 *
 * Creates (or resets) a few sign-in accounts in the local development database so
 * login, profile, security and empty-state screens can be exercised by hand.
 * Test data only: the addresses use the reserved .test domain and can never receive mail.
 * The accounts have no Stripe customer, cards, subscriptions or orders.
 *
 * Usage (from backend/): node --import tsx scripts/seed-test-users.ts
 */
import 'dotenv/config';
import {hash} from 'bcryptjs';
import {PrismaClient} from '@prisma/client';

/** Shared by every test user below. Local development only. */
export const TEST_PASSWORD = 'Junction-Test-Only-2026';

export const TEST_USERS = [
  {email: 'test.member@example.test', name: 'Taylor Member', phone: '+1 630 555 0101', company: 'Member Test Co', marketingOptIn: false},
  {email: 'test.second@example.test', name: 'Sam Second', phone: '+1 630 555 0102', company: '', marketingOptIn: true},
  {email: 'test.minimal@example.test', name: 'Mina Minimal', phone: '', company: '', marketingOptIn: false},
];

/** Staff sign-ins for the admin area. There is no "manager" role: EDITOR is the manager-level one. */
export const TEST_STAFF = [
  {email: 'test.admin@example.test', name: 'Avery Admin', role: 'ADMIN' as const},
  {email: 'test.manager@example.test', name: 'Morgan Manager', role: 'EDITOR' as const},
  {email: 'test.viewer@example.test', name: 'Val Viewer', role: 'VIEWER' as const},
];

async function main() {
  const host = new URL(process.env.DATABASE_URL || '').hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error('Refusing to seed test users: DATABASE_URL is not a local database.');
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed test users in production.');

  const prisma = new PrismaClient();
  try {
    const passwordHash = await hash(TEST_PASSWORD, 12);
    const now = new Date();
    for (const user of TEST_USERS) {
      const account = {
        name: user.name,
        phone: user.phone || null,
        company: user.company || null,
        accountStatus: 'ACTIVE' as const,
        emailVerifiedAt: now,
        passwordHash,
        passwordChangedAt: now,
        failedLoginCount: 0,
        lockedUntil: null,
        accountTermsVersion: '2026-11-account-v1',
        accountTermsAcceptedAt: now,
        marketingOptIn: user.marketingOptIn,
        marketingConsentAt: user.marketingOptIn ? now : null,
      };
      const saved = await prisma.customer.upsert({
        where: {emailKey: user.email},
        update: account,
        create: {email: user.email, emailKey: user.email, ...account},
      });
      console.log('[test-users] ready:', saved.email);
    }
    for (const staff of TEST_STAFF) {
      const saved = await prisma.user.upsert({
        where: {email: staff.email},
        update: {name: staff.name, role: staff.role, active: true, passwordHash},
        create: {email: staff.email, name: staff.name, role: staff.role, active: true, passwordHash},
      });
      console.log('[test-users] ready:', saved.email, '(' + saved.role + ')');
    }
    console.log('[test-users] Password for all of them: see TEST_PASSWORD in backend/scripts/seed-test-users.ts');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
