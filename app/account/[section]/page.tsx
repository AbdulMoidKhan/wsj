import {Suspense} from 'react';
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {PublicLayout} from '@/components/public-layout';
import {AccountArea, type AccountSection} from '@/components/account-area';

const SECTIONS: Record<string, {section: AccountSection; title: string}> = {
  subscriptions: {section: 'subscriptions', title: 'My subscriptions'},
  purchases: {section: 'purchases', title: 'Purchases'},
  bookings: {section: 'bookings', title: 'Bookings'},
  'payment-methods': {section: 'payment-methods', title: 'Payment methods'},
  billing: {section: 'billing', title: 'Billing & invoices'},
  profile: {section: 'profile', title: 'Profile'},
  security: {section: 'security', title: 'Security'},
};

export const dynamicParams = false;
export function generateStaticParams() {
  return Object.keys(SECTIONS).map(section => ({section}));
}

export async function generateMetadata({params}: {params: Promise<{section: string}>}): Promise<Metadata> {
  const {section} = await params;
  return {title: SECTIONS[section]?.title ?? 'Your account', robots: {index: false, follow: false}};
}

export default async function AccountSectionPage({params}: {params: Promise<{section: string}>}) {
  const {section} = await params;
  const entry = SECTIONS[section];
  if (!entry) notFound();
  return (
    <PublicLayout>
      <main id="main" className="aa-page">
        <Suspense fallback={null}>
          <AccountArea section={entry.section} />
        </Suspense>
      </main>
    </PublicLayout>
  );
}
