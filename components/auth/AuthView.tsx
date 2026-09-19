import React, { useState } from 'react';
import { RecoveryFlow } from './RecoveryFlow';

interface AuthViewProps {
  onAuthSuccess: (user: any) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistStatus, setWaitlistStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [waitlistError, setWaitlistError] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    geminiKey: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [pendingAuth, setPendingAuth] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
    const payload = isLogin
      ? { emailOrUsername: formData.email || formData.username, password: formData.password }
      : formData;

    try {
      const csrf = await fetch('/api/auth/csrf', { credentials: 'same-origin' }).then(r => r.json());
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.csrfToken },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Authentication failed');

      if (data.recoveryCodes?.length) {
        setRecoveryCodes(data.recoveryCodes);
        setPendingAuth(data);
        return;
      }

      if (data.user.geminiKey) {
        localStorage.setItem('hmap-gemini-api-key', data.user.geminiKey);
      }

      onAuthSuccess(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWaitlistStatus('loading');
    setWaitlistError('');

    try {
      // Detect platform
      let platform = 'Unknown';
      if (navigator.userAgent.indexOf('iPhone') !== -1 || navigator.userAgent.indexOf('iPad') !== -1) platform = 'iOS';
      else if (navigator.userAgent.indexOf('Linux') !== -1) platform = 'Linux';
      else if (navigator.userAgent.indexOf('Windows') !== -1) platform = 'Windows';

      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: waitlistEmail, platform })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to join waitlist');

      setWaitlistStatus('success');
    } catch (err: any) {
      setWaitlistError(err.message);
      setWaitlistStatus('error');
    }
  };

  const features = [
    { id: '01', color: '#06b6d4', title: 'Literature Synthesis', desc: 'Leverages advanced LLMs to ingest and synthesize vast amounts of scientific literature, identifying research gaps and establishing a rigorous theoretical foundation for your project.' },
    { id: '02', color: '#10b981', title: 'Hypothesis Simulation', desc: 'Utilizes agentic code execution to simulate experimental outcomes and synthesize synthetic datasets, allowing for rapid iteration before physical lab work begins.' },
    { id: '03', color: '#f59e0b', title: 'Analytical Workspace', desc: 'A high-density data environment for processing CSVs and complex datasets with real-time visualization, statistical interpretation, and automated insight extraction.' },
    { id: '04', color: '#ec4899', title: 'Peer-Review Protocol', desc: 'Subjects your methodology and findings to a simulated multi-agent peer review process, identifying potential biases, logical fallacies, and areas for empirical strengthening.' },
    { id: '05', color: '#ef4444', title: 'Manuscript Architect', desc: 'Automates the transition from raw data and lab notes to publication-ready drafts, ensuring adherence to scientific standards and proper provenance tracking.' }
  ];

  if (recoveryCodes.length && pendingAuth) return <main className="min-vh-100 bg-dark text-light d-flex align-items-center justify-content-center p-4"><section className="card bg-dark text-light border-warning p-4" style={{maxWidth:560}}><h1 className="h4">Save your recovery codes</h1><p>These one-time codes are the only no-email recovery method. They will not be shown again.</p><pre className="bg-black text-light p-3 user-select-all">{recoveryCodes.join('\n')}</pre><button className="btn btn-outline-light mb-2" onClick={()=>{const b=new Blob([recoveryCodes.join('\n')+'\n'],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='hypatia-recovery-codes.txt';a.click();URL.revokeObjectURL(a.href)}}>Download codes</button><button className="btn btn-primary" onClick={()=>onAuthSuccess(pendingAuth.user)}>I saved the codes</button></section></main>;

  return (
    <>
      <style>{`
        .hero-gradient-text { background: linear-gradient(90deg,#f8fafc,#c7d2fe); -webkit-background-clip: text; background-clip: text; color: transparent; }
        @media (max-width: 991px) { .hero-gradient-text { font-size: 2rem; } }
      `}</style>
      <div className="min-vh-100 d-flex flex-column flex-lg-row bg-[#0b1020] text-[#f8fafc] font-['Inter'] overflow-hidden" style={{ position: 'relative', zIndex: 0 }}>
        {/* Left Side: Hero */}
        <div className="flex-grow-1 d-flex flex-column justify-content-center p-4 p-lg-5 position-relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(6,182,212,0.10) 45%, rgba(11,16,32,0) 75%)' }}>
          <div className="position-absolute top-0 start-0 w-100 h-100" style={{ background: 'radial-gradient(circle at 85% 15%, rgba(6, 182, 212, 0.12) 0%, transparent 45%), radial-gradient(circle at 15% 85%, rgba(99, 102, 241, 0.15) 0%, transparent 45%)' }}></div>

          <div className="position-relative" style={{ maxWidth: '720px' }}>
            <div className="d-inline-flex align-items-center gap-2 px-3 py-1 mb-4 rounded-pill" style={{ border: '1px solid rgba(99,102,241,0.4)', background: 'rgba(99,102,241,0.08)', fontSize: '11px', letterSpacing: '0.25em', fontWeight: 700 }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
              MIFECO SCIENTIFIC PLATFORM
            </div>
            <h1 className="fw-black font-['Space_Grotesk'] tracking-tighter mb-3" style={{ fontSize: 'clamp(2.6rem, 5.5vw, 4.8rem)', lineHeight: 1.02 }}>
              <span className="hero-gradient-text">Research that</span><br />
              <span className="hero-gradient-text">runs itself —</span><br />
              <span style={{ background: 'linear-gradient(90deg, #6366f1, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>from idea to paper</span>
            </h1>
            <p className="text-base text-[#94a3b8] mb-4" style={{ maxWidth: '540px', fontSize: '15px' }}>
              Hypatia Pro is an AI-first scientific research workspace: it reads the literature, stress-tests your hypotheses, analyzes your data, and drafts publication-ready manuscripts while you stay in control of every step.
            </p>

            <div className="row g-3 mt-2">
              {features.map((feature) => (
                <div key={feature.id} className="col-12 col-md-6 animate-in">
                  <div className="feature-card h-100 p-3 rounded-4" style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(30,41,59,0.45)', backdropFilter: 'blur(12px)' }}>
                    <div className="d-flex align-items-start gap-3">
                      <span className="fw-bold font-['Space_Grotesk']" style={{ color: feature.color, fontSize: '1.15rem', minWidth: '28px' }}>{feature.id}</span>
                      <div>
                        <h3 className="h6 fw-bold mb-1" style={{ fontSize: '0.85rem', letterSpacing: '0.04em' }}>{feature.title}</h3>
                        <p className="text-xs text-[#94a3b8] mb-0" style={{ fontSize: '0.72rem', lineHeight: 1.45 }}>{feature.desc}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Grounded why-worthwhile strip */}
            <div className="d-flex flex-wrap gap-3 mt-4">
              {[
                { icon: 'bi-lightning-charge', label: 'Days of desk research, compressed' },
                { icon: 'bi-shield-check', label: 'You verify every output' },
                { icon: 'bi-key', label: 'Bring your own AI key' },
              ].map((b) => (
                <div key={b.label} className="d-inline-flex align-items-center gap-2 px-3 py-2 rounded-3" style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15,23,42,0.5)', fontSize: '11px', color: '#94a3b8' }}>
                  <i className={`bi ${b.icon}`} style={{ color: '#06b6d4' }}></i> {b.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="w-100 d-flex align-items-center justify-content-center p-4 p-lg-5 position-relative" style={{ background: '#0b1020', flexBasis: '480px', flexShrink: 0 }}>
          <div className="position-absolute top-50 start-50 translate-middle w-75 h-75 rounded-full blur-[120px]" style={{ background: 'rgba(99, 102, 241, 0.06)' }}></div>

          <div className="card w-100 border-0 rounded-3xl p-4 p-lg-5 shadow-2xl" style={{ maxWidth: '440px', background: 'rgba(30,41,59,0.65)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {/* Subscribe CTA (LIVE Stripe Payment Link) */}
            <div className="mb-4 d-flex flex-column align-items-center gap-2 p-3 rounded-3xl" style={{ border: '1px solid rgba(99,102,241,0.35)', background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(6,182,212,0.10))' }}>
              <a
                href="https://buy.stripe.com/6oUdRa3Q74HIaYigiw7Vm04"
                target="_blank"
                rel="noopener noreferrer"
                data-test="stripe-payment-link-public"
                data-buy-button-id="buy_btn_1UEyGgLFWluMTxK7Mr8r8PH8"
                className="btn btn-lg w-100 px-4 rounded-2xl fw-black tracking-widest"
                style={{ background: 'linear-gradient(135deg, #6366f1, #06b6d4)', color: '#fff', boxShadow: '0 10px 30px -10px rgba(99,102,241,0.6)' }}
              >
                <i className="bi bi-stars me-2"></i> Sign up for a paid subscription — $49/MO
              </a>
              <span className="text-[10px] fw-bold tracking-widest uppercase text-[#94a3b8]">Secure live monthly checkout</span>
            </div>
            <div className="d-flex mb-4 bg-[#0b1020] p-1 rounded-2xl">
              <button
                onClick={() => setIsLogin(true)}
                className={`flex-grow-1 py-2 rounded-xl text-xs fw-bold tracking-widest transition-all ${isLogin ? 'bg-[#f8fafc] text-[#0b1020]' : 'text-[#94a3b8]'}`}
              >
                SIGN IN
              </button>
              <button
                onClick={() => setIsLogin(false)}
                className={`flex-grow-1 py-2 rounded-xl text-xs fw-bold tracking-widest transition-all ${!isLogin ? 'bg-[#f8fafc] text-[#0b1020]' : 'text-[#94a3b8]'}`}
              >
                SIGN UP
              </button>
            </div>

            {showRecovery ? <RecoveryFlow onClose={() => setShowRecovery(false)} /> : <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="mb-4">
                  <label className="d-block text-[10px] fw-black text-[#f8fafc] tracking-[0.2em] mb-2 uppercase">Username</label>
                  <input
                    type="text"
                    required
                    className="form-control bg-[#0b1020] border-[rgba(255,255,255,0.08)] rounded-2xl py-3 px-4 text-sm focus:border-[#06b6d4] focus:shadow-[0_0_15px_rgba(6,182,212,0.1)] transition-all"
                    value={formData.username}
                    onChange={e => setFormData({...formData, username: e.target.value})}
                  />
                </div>
              )}
              <div className="mb-4">
                <label className="d-block text-[10px] fw-black text-[#f8fafc] tracking-[0.2em] mb-2 uppercase">{isLogin ? 'Email or Username' : 'Email Address'}</label>
                <input
                  type={isLogin ? "text" : "email"}
                  required
                  className="form-control bg-[#0b1020] border-[rgba(255,255,255,0.08)] rounded-2xl py-3 px-4 text-sm focus:border-[#06b6d4] focus:shadow-[0_0_15px_rgba(6,182,212,0.1)] transition-all"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div className="mb-4">
                <label className="d-block text-[10px] fw-black text-[#f8fafc] tracking-[0.2em] mb-2 uppercase">Password</label>
                <input
                  type="password"
                  required
                  minLength={isLogin ? undefined : 12}
                  className="form-control bg-[#0b1020] border-[rgba(255,255,255,0.08)] rounded-2xl py-3 px-4 text-sm focus:border-[#06b6d4] focus:shadow-[0_0_15px_rgba(6,182,212,0.1)] transition-all"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                />
              </div>
              {!isLogin && (
                <div className="mb-4">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <label className="d-block text-[10px] fw-black text-[#f8fafc] tracking-[0.2em] uppercase">Gemini API Key <span className="text-[#94a3b8]" style={{ textTransform: 'none', fontWeight: 600 }}>(your own key — BYOK)</span></label>
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-[#06b6d4] text-[10px] fw-bold tracking-widest text-decoration-none hover:text-[#f8fafc]">GET API KEY</a>
                  </div>
                  <input
                    type="password"
                    className="form-control bg-[#0b1020] border-[rgba(255,255,255,0.08)] rounded-2xl py-3 px-4 text-sm focus:border-[#06b6d4] focus:shadow-[0_0_15px_rgba(6,182,212,0.1)] transition-all"
                    value={formData.geminiKey}
                    onChange={e => setFormData({...formData, geminiKey: e.target.value})}
                  />
                </div>
              )}

              {error && <p className="text-danger small mb-4">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="btn w-100 bg-[#f8fafc] text-[#0b1020] fw-black py-3 rounded-2xl tracking-widest hover:bg-[#06b6d4] hover:scale-[1.02] transition-all disabled:opacity-50"
              >
                {loading ? 'PROCESSING...' : (isLogin ? 'Sign in to use your own key' : 'INITIALIZE')}
              </button>
              {isLogin && <button type="button" className="btn btn-link w-100 text-info" onClick={() => setShowRecovery(true)}>Forgot password?</button>}
            </form>}

            <div className="mt-3 text-center">
              <a
                href="https://buy.stripe.com/bJe3cw72j5LM5DY5DS7Vm06"
                target="_blank"
                rel="noopener noreferrer"
                data-test="open-source-support-link"
                data-buy-button-id="buy_btn_1UEyKaLFWluMTxK7KJNimjix"
                className="btn btn-link text-[#94a3b8] text-[10px] fw-bold tracking-widest text-decoration-none hover:text-[#06b6d4]"
              >
                Support Open-Source Development (optional)
              </a>
            </div>

            <div className="mt-4 text-center">
              <button
                onClick={() => setShowWaitlist(true)}
                className="btn btn-link text-[#94a3b8] text-[10px] fw-bold tracking-widest text-decoration-none hover:text-[#f8fafc]"
              >
                JOIN WAITLIST FOR PRO VERSION
              </button>
            </div>
          </div>

        </div>

        <div className="position-absolute bottom-4 start-50 translate-middle-x d-flex align-items-center gap-4 z-3">
          <div className="text-[10px] font-monospace text-[#94a3b8] opacity-50">
            MIFECO © 2026 V3.01
          </div>
        </div>
      </div>

      {/* Waitlist Modal - Rendered outside main layout for absolute top-level stacking */}
      {showWaitlist && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{
            backgroundColor: 'rgba(2, 6, 23, 0.98)',
            backdropFilter: 'blur(12px)',
            zIndex: 999999
          }}
        >
          <div className="card w-100 border-0 rounded-3xl p-5 shadow-2xl animate-in" style={{ maxWidth: '520px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="d-flex justify-content-between align-items-start mb-4">
              <div>
                <h2 className="h4 fw-black font-['Space_Grotesk'] tracking-tight mb-1">HYPATIA PRO <span className="text-[#6366f1] text-xs">WAITLIST</span></h2>
                <p className="text-xs text-[#94a3b8] tracking-widest uppercase">The future of vibe coding like research assistance ...</p>
              </div>
              <button onClick={() => { setShowWaitlist(false); setWaitlistStatus('idle'); }} className="btn-close btn-close-white"></button>
            </div>

            <div className="mb-5">
              <h3 className="text-xs fw-bold text-[#f8fafc] tracking-widest mb-3 uppercase">EXCLUSIVE PRO FEATURES</h3>
              <ul className="list-unstyled space-y-3">
                {[
                  { icon: 'bi-cpu', text: 'AssS Connectivity: Direct integration with high-performance compute clusters.' },
                  { icon: 'bi-flask', text: 'Better integration with real laboratory experiments via IoT protocols.' },
                  { icon: 'bi-lightbulb', text: 'Advanced hypothesis generation with automated uniqueness grading.' },
                  { icon: 'bi-people', text: 'Multi-agent peer review simulations with diverse academic personas.' },
                  { icon: 'bi-journal-text', text: 'Direct export to major scientific journals (Nature, Science, Cell).' }
                ].map((item, i) => (
                  <li key={i} className="d-flex align-items-start gap-3 text-sm text-[#94a3b8]">
                    <i className={`bi ${item.icon} text-[#06b6d4]`}></i>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {waitlistStatus === 'success' ? (
              <div className="text-center py-4">
                <i className="bi bi-check-circle-fill text-[#10b981] display-4 mb-3 d-block"></i>
                <h4 className="fw-bold mb-2">YOU'RE ON THE LIST</h4>
                <p className="text-sm text-[#94a3b8]">We'll notify you as soon as Hypatia Pro is ready for deployment.</p>
                <button onClick={() => setShowWaitlist(false)} className="btn btn-primary w-100 mt-4 rounded-2xl py-3 fw-bold">CLOSE</button>
              </div>
            ) : (
              <form onSubmit={handleWaitlistSubmit}>
                <div className="mb-4">
                  <label className="d-block text-[10px] fw-black text-[#f8fafc] tracking-[0.2em] mb-2 uppercase">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="researcher@institute.edu"
                    className="form-control bg-[#0b1020] border-[rgba(255,255,255,0.08)] rounded-2xl py-3 px-4 text-sm focus:border-[#06b6d4] transition-all"
                    value={waitlistEmail}
                    onChange={e => setWaitlistEmail(e.target.value)}
                  />
                </div>
                {waitlistError && <p className="text-danger text-xs mb-3">{waitlistError}</p>}
                <button
                  type="submit"
                  disabled={waitlistStatus === 'loading'}
                  className="btn w-100 text-white fw-black py-3 rounded-2xl tracking-widest transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
                >
                  {waitlistStatus === 'loading' ? 'PROCESSING...' : 'SECURE EARLY ACCESS'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};
