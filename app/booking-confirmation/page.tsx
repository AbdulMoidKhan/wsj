import {Suspense} from 'react';
import type {Metadata} from 'next';
import {PublicLayout} from '@/components/public-layout';
import {BookingConfirmationClient} from '@/components/booking-status';

export const metadata: Metadata = {
  title: 'Booking confirmation',
  robots: {index: false, follow: true},
};

export default function BookingConfirmationPage() {
  return (
    <PublicLayout>
      <main id="main" className="wj-policy">
        <header className="wj-policy-header">
          <div className="container">
            <p className="eyebrow">BOOKING</p>
            <h1>Booking confirmation.</h1>
          </div>
        </header>
        <Suspense fallback={<article className="container wj-policy-body"><p>Loading booking details&hellip;</p></article>}>
          <BookingConfirmationClient />
        </Suspense>
      </main>
    </PublicLayout>
  );
}
