import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import express from 'express';
import Stripe from 'stripe';
import { installPaymentLinks } from '../server/paymentLinks.mjs';

const secret = 'whsec_unit_test_only';
const link = 'https://buy.stripe.com/test_example';
const signing = new Stripe('sk_test_unit_only');
async function fixture(t, overrides = {}) {
  const sqlite = new DatabaseSync(':memory:');
  const db = {
    exec: async sql => sqlite.exec(sql),
    run: async (sql, params=[]) => sqlite.prepare(sql).run(...params),
    get: async (sql, params=[]) => sqlite.prepare(sql).get(...params),
    all: async (sql, params=[]) => sqlite.prepare(sql).all(...params),
  };
  let session = { id: 'cs_verified', payment_link: { id: 'plink_verified', url: link },
    livemode: false, mode: 'subscription', status: 'complete', payment_status: 'paid', subscription: 'sub_verified' };
  let subscription = { status: 'active', livemode: false, items: { data: [{ price: { id: 'price_approved' } }] } };
  const stripe = {
    webhooks: signing.webhooks,
    checkout: { sessions: { retrieve: async () => session } },
    subscriptions: { retrieve: async () => { if (subscription instanceof Error) throw subscription; return subscription; } },
    paymentLinks: { listLineItems: async () => ({ has_more: false, data: [{price:{id:'price_approved'}}] }) },
  };
  const app = express();
  await installPaymentLinks(app, { db, stripe, product: 'engineer', paymentLink: link,
    authenticate: async req => req.headers.authorization ? { id: req.headers.authorization } : null,
    config: { STRIPE_BILLING_ENABLED:'true', STRIPE_SECRET_KEY:'sk_test_unit_only',
      STRIPE_WEBHOOK_SECRET:secret, APP_ORIGIN:'https://app.example', MIFECO_BILLING_PROJECT_ID:'billing-test', ...overrides } });
  app.use(express.json());
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); sqlite.close(); });
  const base = 'http://127.0.0.1:' + server.address().port;
  async function call(path, options={}) { return fetch(base + path, options); }
  async function start(user='owner') {
    const res = await call('/api/billing/start', {method:'POST', headers:{origin:'https://app.example',authorization:user}});
    const result = await res.json();
    assert.equal(res.status,200);
    session.client_reference_id = new URL(result.url).searchParams.get('client_reference_id');
    return result;
  }
  async function webhook({tamper=false, type='checkout.session.completed'}={}) {
    const payload = JSON.stringify({id:'evt_retry',type,data:{object:{id:session.id}}});
    const signature = signing.webhooks.generateTestHeaderString({payload,secret});
    return call('/api/billing/stripe-webhook',{method:'POST',headers:{'content-type':'application/json','stripe-signature':signature},body:tamper?payload+' ':payload});
  }
  return {db,call,start,webhook,session,subscription,setSubscription:value=>{subscription=value;}};
}
test('signed paid checkout binds reference to account; replay is idempotent',async t=>{
  const f=await fixture(t); const {url}=await f.start();
  assert.equal(url.split('?')[0],link);
  assert.match(f.session.client_reference_id,/^[a-f0-9]{48}$/);
  assert.equal((await f.webhook()).status,200); assert.equal((await f.webhook()).status,200);
  assert.equal((await f.db.all('SELECT * FROM mifeco_billing_subscriptions')).length,1);
  assert.equal((await f.call('/api/billing/entitlement',{headers:{authorization:'owner'}})).status,200);
  assert.equal((await f.call('/api/billing/entitlement',{headers:{authorization:'other'}})).status,403);
});
test('tampered webhook cannot provision',async t=>{
  const f=await fixture(t); await f.start(); assert.equal((await f.webhook({tamper:true})).status,400);
  assert.equal((await f.db.all('SELECT * FROM mifeco_billing_subscriptions')).length,0);
});
test('another product link and unpaid checkout cannot provision',async t=>{
  const f=await fixture(t); await f.start(); f.session.payment_link.url='https://buy.stripe.com/wrong';
  await f.webhook(); f.session.payment_link.url=link; f.session.payment_status='unpaid'; await f.webhook();
  assert.equal((await f.db.all('SELECT * FROM mifeco_billing_subscriptions')).length,0);
});
test('anonymous payment requires reconciliation instead of guessing owner by email',async t=>{
  const f=await fixture(t); f.session.client_reference_id='unknown'; f.session.customer_email='owner@example.test';
  assert.equal((await f.webhook()).status,409);
});
test('cancellation, payment failure, changed product and outage deny access',async t=>{
  const f=await fixture(t); await f.start(); await f.webhook();
  for(const status of ['canceled','past_due','unpaid','incomplete','trialing']) {
    f.subscription.status=status; assert.equal((await f.call('/api/billing/entitlement',{headers:{authorization:'owner'}})).status,403);
  }
  f.subscription.status='active'; f.subscription.items.data[0].price.id='wrong_price';
  assert.equal((await f.call('/api/billing/entitlement',{headers:{authorization:'owner'}})).status,403);
  f.setSubscription(new Error('Stripe unavailable'));
  assert.equal((await f.call('/api/billing/entitlement',{headers:{authorization:'owner'}})).status,503);
});
test('checkout requires same-origin request, authentication and complete configuration',async t=>{
  const f=await fixture(t);
  assert.equal((await f.call('/api/billing/start',{method:'POST',headers:{origin:'https://attacker.example',authorization:'owner'}})).status,403);
  assert.equal((await f.call('/api/billing/start',{method:'POST',headers:{origin:'https://app.example'}})).status,401);
  const disabled=await fixture(t,{STRIPE_WEBHOOK_SECRET:''});
  assert.equal((await disabled.call('/api/billing/start',{method:'POST',headers:{origin:'https://app.example',authorization:'owner'}})).status,503);
});
