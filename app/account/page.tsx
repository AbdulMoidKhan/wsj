import {Suspense} from 'react';
import type {Metadata} from 'next';
import {PublicLayout} from '@/components/public-layout';
import {AccountPortal} from '@/components/account-portal';

export const metadata: Metadata = {
  title: 'Your account',
  robots: {index: false, follow: false},
};

export default function AccountPage() {
  return (
    <PublicLayout>
      <main id="main" className="wj-policy">
        <header className="wj-policy-header">
          <div className="container">
            <p className="eyebrow">MEMBERSHIP</p>
            <h1>Your account.</h1>
          </div>
        </header>
        <Suspense fallback={<div className="container"><p>Loading your account&hellip;</p></div>}>
          <AccountPortal />
        </Suspense>
      </main>
    </PublicLayout>
  );
}
