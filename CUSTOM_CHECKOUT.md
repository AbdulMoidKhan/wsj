# Custom checkout with Stripe payment processing

Our own checkout UI, inside the booking popup. Stripe processes the payment and
the recurring billing; it never renders a hosted page and the customer is never
redirected away.

## What changed

- **No Stripe Checkout in the new flow.** The booking popup now renders the
  Stripe **Payment Element** as a field of our own form, beside the email, name
  and coupon inputs. `checkout.sessions.create` and the embedded Checkout step
  are no longer used by this path; the existing session webhook handling is kept
  so historical orders still reconcile.
- **Automatic renewal is opt-in.** A checkbox on the right of the checkout reads
  *"Continue my subscription and automatically renew next month."* It is never
  pre-selected, states the renewal price, frequency and cancellation terms
  before it is ticked, and the choice is stored on the order.
- **Unticked = one paid period.** No Stripe subscription is created, no payment
  method is saved for off-session use, and nothing is charged next month. The
  paid term is recorded locally with a `paidThrough` date and ends by itself.
- **Ticked = a real Stripe subscription**, created `default_incomplete` with
  `save_default_payment_method: on_subscription`, confirmed from our own form
  through the first invoice's confirmation secret.

## Public API

All new routes answer with `{success, message, data, error?}`.

| Route | Purpose |
| :--- | :--- |
| `GET /api/public/payments/config` | Publishable key only. |
| `POST /api/public/payments/intents` | Price, create or resume the order, return a client secret. Requires `Idempotency-Key` and `X-Checkout-Token`. |
| `GET /api/public/payments/orders/:id` | Order status. Requires `X-Checkout-Token`. |
| `POST /api/public/payments/orders/:id/cancel` | Abandon an unpaid attempt only. |

`intentType` tells the browser what to confirm: `payment`, `setup` (nothing due
now, for example a full discount on a renewing plan) or `none`.

## Security decisions

- **The server prices everything.** The request names catalogue entries and
  quantities; amounts, discounts and intervals are recomputed from the database.
  Unknown body fields such as `unitAmountCents` are rejected by validation.
- **Payment is proven by webhook, never by the browser.** Only a
  signature-verified `payment_intent.succeeded` or `invoice.paid` marks an order
  PAID, and only after checking that the order already references that intent,
  and that the currency and amount received match what was priced.
- **Reading an order needs the capability minted for that attempt.** A random
  32-byte token is stored only as a SHA-256 hash, compared in constant time, and
  kept in `sessionStorage` rather than the URL. Without it, a known order id
  returns the same 404 as an unknown one.
- **The public order status no longer issues an account token.** It previously
  returned a customer portal JWT to anyone who knew an order id. Management is
  reached through the emailed sign-in link instead.
- **Duplicate payments are prevented twice over.** A unique `idempotencyKey`
  column reserves one order per attempt, and the same key is passed to Stripe,
  so a retry, a double click or two racing submissions converge on one charge.
  A reused key describing a different purchase is rejected with 409.
- **Guest checkout cannot overwrite a customer.** An unverified email fills in
  blanks only; an existing name or phone is never replaced.
- **Errors are mapped, not echoed.** Declines, expiry, CVC, connection and rate
  limit failures become specific customer-facing messages with a stable code;
  provider text, keys and account detail stay in the server log.
- Rate limits are applied per route, write requests must come from a configured
  front-end origin, and no client secret is written to the database or logs.

## Lifecycle

| State | Renewing subscription | Single paid term |
| :--- | :--- | :--- |
| Record | Stripe subscription, synced from Stripe | Local row, `stripeSubscriptionId` null |
| Renewal | Charged each period until cancelled | Never |
| Access ends | When Stripe reports it ended | At `paidThrough` |
| Cancellation | Stops renewal, access runs to period end | Nothing to cancel; the paid period is kept |

Entitlement credits are granted once per paid period, keyed by a unique source
reference, so a replayed webhook cannot grant twice.

## Verification

`npm run test:release` covers 236 offline checks, including 25 for this flow:
an unticked box never creating a subscription, renewal refused without the
recurring terms, browser-sent amounts being ignored, retries and races
producing one charge, capability-scoped reads, declines leaving the attempt
payable, replayed and mismatched webhooks granting nothing, and finite terms
expiring on their own. Frontend typecheck, lint and production build pass.

**Not verified here:** no real card was charged, and no refund, live webhook
delivery or production deployment was performed. The database migration was
applied to the local development database only.
