import React, { useState } from 'react';

async function csrfPost(path: string, body: unknown) {
  const csrf = await fetch('/api/auth/csrf', { credentials: 'same-origin' }).then(r => r.json());
  return fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.csrfToken }, body: JSON.stringify(body) });
}

export const RecoveryFlow: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [step, setStep] = useState<'code'|'password'|'done'>('code');
  const [identifier, setIdentifier] = useState(''); const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState(''); const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const start = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); setMessage(''); try { const r = await csrfPost('/api/auth/recovery/start', { identifier, recoveryCode: code }); const d = await r.json(); if (r.status === 429) setMessage(d.error); else if (d.resetToken) { setResetToken(d.resetToken); setStep('password'); } else setMessage(d.message); } finally { setBusy(false); } };
  const finish = async (e: React.FormEvent) => { e.preventDefault(); setBusy(true); setMessage(''); try { const r = await csrfPost('/api/auth/recovery/complete', { resetToken, password, passwordConfirmation: confirmation }); const d = await r.json(); if (r.ok) setStep('done'); else setMessage(d.error); } finally { setBusy(false); } };
  return <div role="dialog" aria-modal="true" aria-labelledby="recovery-title" className="p-4 rounded-3 bg-dark border border-secondary">
    <h2 id="recovery-title" className="h5">Recover account without email</h2>
    <p className="small text-secondary">Use one unused recovery code saved when you created or secured your account.</p>
    {step === 'code' && <form onSubmit={start}><label className="form-label">Username or account identifier</label><input className="form-control mb-3" required autoComplete="username" value={identifier} onChange={e=>setIdentifier(e.target.value)}/><label className="form-label">Recovery code</label><input className="form-control mb-3" required autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value)}/><button disabled={busy} className="btn btn-primary w-100">Continue</button></form>}
    {step === 'password' && <form onSubmit={finish}><label className="form-label">New password (12–256 characters)</label><input className="form-control mb-3" type="password" minLength={12} maxLength={256} required autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/><label className="form-label">Confirm new password</label><input className="form-control mb-3" type="password" minLength={12} maxLength={256} required autoComplete="new-password" value={confirmation} onChange={e=>setConfirmation(e.target.value)}/><button disabled={busy} className="btn btn-primary w-100">Set new password</button></form>}
    {step === 'done' && <p role="status">Password changed. All other sessions were signed out. You can now sign in.</p>}
    {message && <p role="alert" className="small text-warning mt-3">{message}</p>}<button type="button" className="btn btn-link w-100 mt-2" onClick={onClose}>Back to sign in</button>
  </div>;
};

export const RecoveryCodeManager: React.FC = () => {
  const [password, setPassword] = useState(''); const [codes, setCodes] = useState<string[]>([]); const [message, setMessage] = useState('');
  const regenerate = async (e: React.FormEvent) => { e.preventDefault(); setMessage(''); const r = await csrfPost('/api/auth/recovery/regenerate', { currentPassword: password }); const d = await r.json(); if (r.ok) { setCodes(d.recoveryCodes); setPassword(''); } else setMessage(d.error); };
  const download = () => { const blob = new Blob([codes.join('\n')+'\n'], {type:'text/plain'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='mifeco-recovery-codes.txt'; a.click(); URL.revokeObjectURL(a.href); };
  return <section aria-labelledby="recovery-codes-title"><h3 id="recovery-codes-title" className="h6">Recovery codes</h3><p className="small text-secondary">Regenerating invalidates every old code. Codes are shown only once.</p><form onSubmit={regenerate}><label className="form-label">Current password</label><input className="form-control mb-2" type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/><button className="btn btn-outline-warning">Regenerate recovery codes</button></form>{message&&<p role="alert">{message}</p>}{codes.length>0&&<div className="mt-3"><pre className="p-3 bg-black text-white user-select-all">{codes.join('\n')}</pre><button className="btn btn-primary" onClick={download}>Download codes</button></div>}</section>;
};
