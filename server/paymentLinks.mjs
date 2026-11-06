import crypto from 'node:crypto';
import express from 'express';
import Stripe from 'stripe';
import { defaultBillingStore } from './billingStore.mjs';

// Shared MIFECO Payment Links contract. A browser redirect is never proof of payment.
export async function installPaymentLinks(app, { db = null, authenticate, product, paymentLink,
  config = process.env, stripe: injectedStripe = null }) {
  if (db && config.NODE_ENV === 'production') throw new Error('Production billing requires the durable Firestore store');
  if (db) await db.exec(`CREATE TABLE IF NOT EXISTS mifeco_billing_refs (
    reference TEXT PRIMARY KEY, user_id TEXT NOT NULL, product TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS mifeco_billing_subscriptions (
    subscription_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, product TEXT NOT NULL,
    checkout_id TEXT NOT NULL UNIQUE, payment_link_id TEXT NOT NULL);`);
  const enabled = config.STRIPE_BILLING_ENABLED === 'true' &&
    !!config.STRIPE_SECRET_KEY && !!config.STRIPE_WEBHOOK_SECRET && !!config.APP_ORIGIN && !!config.MIFECO_BILLING_PROJECT_ID;
  // SQLite is injectable only for isolated tests. Production uses Firestore atomic creates.
  const store = db ? {
    addReference: (reference,userId) => db.run('INSERT INTO mifeco_billing_refs VALUES (?, ?, ?, ?)',[reference,userId,product,Date.now()]),
    getReference: reference => db.get('SELECT * FROM mifeco_billing_refs WHERE reference=? AND product=?',[reference,product]),
    addSubscription: row => db.run('INSERT OR IGNORE INTO mifeco_billing_subscriptions VALUES (?, ?, ?, ?, ?)',[row.subscription_id,row.user_id,row.product,row.checkout_id,row.payment_link_id]),
    getSubscription: id => db.get('SELECT * FROM mifeco_billing_subscriptions WHERE subscription_id=?',[id]),
    forUser: userId => db.all('SELECT * FROM mifeco_billing_subscriptions WHERE user_id=? AND product=?',[userId,product]),
  } : enabled ? await defaultBillingStore(config, product) : null;
  const stripe = injectedStripe || (enabled ? new Stripe(config.STRIPE_SECRET_KEY, { maxNetworkRetries: 2, timeout: 10000 }) : null);
  const live = config.STRIPE_LIVE_MODE === 'true';
  const unavailable = res => res.status(503).json({ error: 'Subscription activation is not configured', code: 'BILLING_UNAVAILABLE' });
  const userFor = async (req, res) => {
    try {
      const user = await authenticate(req);
      if (!user?.id) { res.status(401).json({ error: 'Sign in to your application account first' }); return null; }
      return user;
    } catch { res.status(503).json({ error: 'Sign-in verification unavailable' }); return null; }
  };
  async function activeSubscription(row) {
    const sub = await stripe.subscriptions.retrieve(row.subscription_id);
    if (sub.livemode !== live || sub.status !== 'active') return false;
    const lines = await stripe.paymentLinks.listLineItems(row.payment_link_id, { limit: 100 });
    if (lines.has_more) throw new Error('Unsupported payment link size');
    const approved = new Set(lines.data.map(item => item.price?.id));
    return sub.items.data.some(item => approved.has(item.price?.id));
  }
  async function verify(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    const requested = req.query?.product;
    if (requested && requested !== product) return res.status(403).json({ allowed: false, error: 'Wrong product' });
    const user = await userFor(req, res); if (!user) return;
    if (!enabled) return unavailable(res);
    try {
      const rows = await store.forUser(String(user.id));
      for (const row of rows) if (await activeSubscription(row)) return res.json({ allowed: true, product, status: 'active' });
      return res.status(403).json({ allowed: false, product, status: 'inactive', error: 'An active subscription is required' });
    } catch { return res.status(503).json({ allowed: false, error: 'Subscription verification unavailable' }); }
  }
  app.get('/api/billing/entitlement', verify);
  app.get('/api/entitlements/verify', verify);
  app.get('/api/billing/config', (_req, res) => res.json({ enabled, product, purchaseUrl: paymentLink }));
  app.post('/api/billing/start', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!enabled) return unavailable(res);
    if (req.headers.origin !== config.APP_ORIGIN) return res.status(403).json({ error: 'Use this application to begin checkout' });
    const user = await userFor(req, res); if (!user) return;
    try {
      const reference = crypto.randomBytes(24).toString('hex');
      await store.addReference(reference, String(user.id));
      const url = new URL(paymentLink);
      url.searchParams.set('client_reference_id', reference);
      return res.json({ url: url.href });
    } catch { return res.status(503).json({ error: 'Could not prepare checkout' }); }
  });
  app.post('/api/billing/stripe-webhook', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
    if (!enabled) return unavailable(res);
    let event;
    try { event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], config.STRIPE_WEBHOOK_SECRET); }
    catch { return res.status(400).json({ error: 'Invalid Stripe signature' }); }
    if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) return res.json({ received: true });
    try {
      const session = await stripe.checkout.sessions.retrieve(event.data.object.id, { expand: ['payment_link'] });
      // Retrieve authoritative data. Ignore checkout events for other MIFECO products.
      if (session.payment_link?.url !== paymentLink || session.livemode !== live) return res.json({ received: true, ignored: true });
      if (session.mode !== 'subscription' || session.status !== 'complete' || session.payment_status !== 'paid') return res.json({ received: true, pending: true });
      const ref = await store.getReference(session.client_reference_id);
      if (!ref) return res.status(409).json({ error: 'Payment needs account reconciliation' });
      const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
      if (!subId) return res.status(409).json({ error: 'Missing subscription' });
      // A single atomic insert is idempotent. Ownership is never overwritten by retries.
      await store.addSubscription({subscription_id:subId,user_id:ref.user_id,product,checkout_id:session.id,payment_link_id:session.payment_link.id});
      const owner = await store.getSubscription(subId);
      if (owner.user_id !== ref.user_id || owner.product !== product) return res.status(409).json({ error: 'Subscription ownership conflict' });
      return res.json({ received: true });
    } catch { return res.status(503).json({ error: 'Payment reconciliation unavailable' }); }
  });
  // Attach this to every paid server operation. Fail closed during Stripe outages.
  const requirePaid = async function requirePaid(req, res, next) {
    const user = await userFor(req, res); if (!user) return;
    if (!enabled) return unavailable(res);
    try {
      const rows = await store.forUser(String(user.id));
      for (const row of rows) if (await activeSubscription(row)) { req.billingUser = user; return next(); }
      return res.status(403).json({ error: 'An active subscription is required' });
    } catch { return res.status(503).json({ error: 'Subscription verification unavailable' }); }
  };
  return { requirePaid, verify };
}
