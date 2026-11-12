import {Suspense} from 'react';
import type {Metadata} from 'next';
import {PublicLayout} from '@/components/public-layout';
import {LoginForm} from '@/components/account-auth-forms';

export const metadata: Metadata = {title: 'Sign in', robots: {index: false, follow: false}};

export default function LoginPage() {
  return (
    <PublicLayout>
      <main id="main">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </main>
    </PublicLayout>
  );
}
