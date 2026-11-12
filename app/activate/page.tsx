import {Suspense} from 'react';
import type {Metadata} from 'next';
import {PublicLayout} from '@/components/public-layout';
import {ActivateForm} from '@/components/account-auth-forms';

/* Account setup, one-time sign-in links and email confirmation all land here.
   The single-use token is in the URL fragment and is removed on load. */
export const metadata: Metadata = {title: 'Your account', robots: {index: false, follow: false}, referrer: 'no-referrer'};

export default function ActivatePage() {
  return (
    <PublicLayout>
      <main id="main">
        <Suspense fallback={null}>
          <ActivateForm />
        </Suspense>
      </main>
    </PublicLayout>
  );
}
