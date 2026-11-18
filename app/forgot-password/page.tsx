import type {Metadata} from 'next';
import {PublicLayout} from '@/components/public-layout';
import {ForgotPasswordForm} from '@/components/account-auth-forms';
import '../legacy-routes.css'; // legacy-template styles (route-scoped; not on the homepage)

export const metadata: Metadata = {title: 'Reset your password', robots: {index: false, follow: false}};

export default function ForgotPasswordPage() {
  return (
    <PublicLayout>
      <main id="main">
        <ForgotPasswordForm />
      </main>
    </PublicLayout>
  );
}
