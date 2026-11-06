# MIFECO Stripe Payment Links integration

The application GitHub repository is authoritative for its code. The Harness Lab is authoritative for lab descriptions, workflows, and free downloads.

## Purchase flow
1. MIFECO and the lab identify the product. Enter the intended application with `?subscribe=1`.
2. Sign in using the existing application authentication. Open Subscriptions, then Continue to Stripe.
3. The server stores a random account reference in Firestore and appends it as `client_reference_id` to the existing Stripe Payment Link. This reference contains no email, password, or key.
4. Stripe sends the signed raw-body webhook to `/api/billing/stripe-webhook`. The server retrieves the authoritative checkout, matches its exact Payment Link, checks completed/paid/subscription/live-mode values, and binds the subscription to the saved account reference using an atomic create.
5. The customer returns to `/?billing=return` and chooses Check activation. The server checks the current Stripe subscription and approved link prices. Canceled, unpaid, past-due, wrong-product, and unavailable verification are denied.

A browser redirect, email address, profile plan, simulation flag, or fabricated session ID cannot activate access. Anonymous payments without an issued account reference return a reconciliation error; do not guess the account from an email. Existing purchases made before this flow need an explicit ownership migration.

## Required deployment configuration
- `STRIPE_BILLING_ENABLED=true` only after the checks below.
- `STRIPE_SECRET_KEY`: runtime Stripe secret for the correct account/mode; store in Secret Manager.
- `STRIPE_WEBHOOK_SECRET`: the secret for this application's webhook endpoint, stored at runtime.
- `STRIPE_LIVE_MODE=true` for the existing live Payment Links; false only with Stripe test-mode links.
- `APP_ORIGIN`: exact HTTPS origin of this application, without a trailing slash.
- `MIFECO_BILLING_PROJECT_ID`: Google project containing the server-owned Firestore billing database.
- `MIFECO_BILLING_DATABASE_ID`: optional; defaults to `(default)`.
- Application Default Credentials from the Cloud Run service identity, with required Firestore access. Billing collection browser reads/writes must be denied by Firestore rules.
- Engineering additionally needs `FIREBASE_PROJECT_ID` matching its existing frontend and Firebase Auth lookup permission for revoked-token checks.

Billing records use Firestore, not Cloud Run's temporary filesystem. Existing application user/project SQLite storage is a separate deployment concern. Do not embed Stripe secrets or operator AI keys in frontend bundles.

## Stripe dashboard
Keep the existing product-specific Payment Link. Set After payment to redirect to this application's `/?billing=return`. Register its HTTPS `/api/billing/stripe-webhook` endpoint for `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Use its own endpoint signing secret. Current subscription status is retrieved on access checks, so no cached webhook state can restore canceled access.

## Verification and limits
Run `node --test tests/payment-links.test.mjs` on Node 24 for isolated HTTP/SQLite test fixtures, plus the application's build and type checks. These tests sign webhook payloads with the Stripe SDK and exercise forged, duplicate, unpaid, wrong-product, wrong-account and canceled access. They do not replace Stripe sandbox tests with actual Firebase/Firestore and Cloud Run identities.

Before production: test the full lifecycle with owned test accounts and test-mode Payment Links; record source commit, container digest, Cloud Run revision, traffic and rollback. Verify all paid server operations use `requirePaid`, with caller-owned AI keys handled explicitly. Engineering currently uses direct browser AI calls; paid provider capacity and all frontend workflows require a separate server-proxy review before marketing an included AI allowance. Free lab downloads remain Apache-2.0 and do not require purchase.

