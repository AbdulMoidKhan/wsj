import type {Metadata} from 'next';
import {PublicLayout} from '@/components/public-layout';
import {ResetPasswordForm} from '@/components/account-auth-forms';

/* The reset token arrives in the URL fragment, which browsers never send to a server. */
export const metadata: Metadata = {title: 'Choose a new password', robots: {index: false, follow: false}, referrer: 'no-referrer'};

export default function ResetPasswordPage() {
  return (
    <PublicLayout>
      <main id="main">
        <ResetPasswordForm />
      </main>
    </PublicLayout>
  );
}
