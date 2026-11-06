import React, { useEffect, useState } from 'react';

export function BillingAccess({ getAuthorization }: { getAuthorization?: () => Promise<string | null> }) {
  const [open, setOpen] = useState(() => new URLSearchParams(location.search).has('subscribe') || new URLSearchParams(location.search).has('billing'));
  const [message, setMessage] = useState('Sign in to this application, then continue to Stripe to subscribe.');
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  useEffect(() => { fetch('/api/billing/config').then(r => r.json()).then(v => setEnabled(v.enabled === true)).catch(() => {}); }, []);
  async function request(path: string, method = 'GET') {
    setBusy(true);
    try {
      const authorization = await getAuthorization?.();
      const result = await fetch(path, { method, credentials: 'same-origin', headers: authorization ? { Authorization: authorization } : {} });
      const data = await result.json();
      if (!result.ok) throw new Error(result.status === 401 ? 'Sign in using the application sign-in form, then reopen Subscriptions.' : data.error || 'Could not verify subscription');
      if (data.url) {
        const url = new URL(data.url);
        if (url.protocol !== 'https:' || url.hostname !== 'buy.stripe.com') throw new Error('Invalid checkout destination');
        location.assign(url.href);
      } else if (data.allowed === true) setMessage('Your subscription is active for this application.');
    } catch (error: any) { setMessage(error.message || 'Subscription service unavailable'); }
    finally { setBusy(false); }
  }
  if (!enabled && !open) return null;
  return <>
    <button onClick={() => setOpen(true)} style={{position:'fixed',bottom:12,left:12,zIndex:90,background:'#15334a',color:'#fff',border:'1px solid #d1844c',borderRadius:8,padding:'10px 16px'}}>Subscriptions</button>
    {open && <div role="dialog" aria-modal="true" aria-labelledby="billing-title" onKeyDown={e => {if(e.key === 'Escape')setOpen(false);}}
      style={{position:'fixed',inset:0,zIndex:200,background:'#071427ee',display:'grid',placeItems:'center',padding:24}}>
      <section style={{background:'#102238',color:'#fff',padding:28,borderRadius:16,maxWidth:500}}>
        <h2 id="billing-title">MIFECO subscription access</h2>
        <p role="status">{message}</p>
        <p>Stripe handles payment details. Return here after payment to check activation.</p>
        {!enabled && <p>Subscription activation is being configured. Please confirm availability with MIFECO before purchasing.</p>}
        <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
          <button disabled={busy || !enabled} onClick={() => request('/api/billing/start','POST')}>Continue to Stripe</button>
          <button disabled={busy || !enabled} onClick={() => request('/api/billing/entitlement')}>Check activation</button>
          <button autoFocus onClick={() => setOpen(false)}>Close</button>
        </div>
      </section>
    </div>}
  </>;
}
