import {Suspense} from 'react';
import type {Metadata} from 'next';
import {PublicLayout} from '@/components/public-layout';
import {AccountArea} from '@/components/account-area';

/* The page shell is static. Account data is fetched in the browser with the
   customer's own session cookie, so nothing customer-specific is ever rendered
   on the server or cached for someone else. */
export const metadata: Metadata = {
  title: 'Your account',
  robots: {index: false, follow: false},
};

export default function AccountPage() {
  return (
    <PublicLayout>
      <main id="main" className="aa-page">
        <Suspense fallback={null}>
          <AccountArea section="overview" />
        </Suspense>
      </main>
    </PublicLayout>
  );
}
