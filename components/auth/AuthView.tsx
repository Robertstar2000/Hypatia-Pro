import React, { useState } from 'react';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
    const payload = isLogin 
      ? { emailOrUsername: formData.email || formData.username, password: formData.password }
      : formData;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Authentication failed');

      localStorage.setItem('hmap-current-user', JSON.stringify(data.user));
      localStorage.setItem('hmap-token', data.token);
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

  return (
    <>
      <div className="min-vh-100 d-flex flex-column flex-lg-row bg-[#0f172a] text-[#f8fafc] font-['Inter'] overflow-hidden" style={{ position: 'relative', zIndex: 0 }}>
        {/* Left Side: Hero */}
        <div className="flex-grow-1 d-flex flex-column justify-content-center p-5 position-relative overflow-hidden" style={{ background: 'radial-gradient(circle at 0% 0%, rgba(99, 102, 241, 0.15) 0%, transparent 50%)' }}>
          <div className="position-absolute top-0 start-0 w-100 h-100" style={{ background: 'radial-gradient(circle at 100% 100%, rgba(139, 92, 246, 0.1) 0%, transparent 50%)' }}></div>
          
          <div className="position-relative max-w-2xl">
            <h1 className="display-1 fw-black font-['Space_Grotesk'] tracking-tighter mb-0">
              <span style={{ color: '#6366f1' }}>M</span>
              <span style={{ color: '#06b6d4' }}>I</span>
              <span style={{ color: '#10b981' }}>F</span>
              <span style={{ color: '#f59e0b' }}>E</span>
              <span style={{ color: '#ec4899' }}>C</span>
              <span style={{ color: '#ef4444' }}>O</span>
            </h1>
            <p className="text-sm font-monospace tracking-[0.3em] text-[#94a3b8] mb-5 uppercase">Ai assisted Scientific Research Protocol</p>
            
            <div className="space-y-6">
              {[
                { id: '01', color: '#06b6d4', title: 'Literature Synthesis', desc: 'Leverages advanced LLMs to ingest and synthesize vast amounts of scientific literature, identifying research gaps and establishing a rigorous theoretical foundation for your project.' },
                { id: '02', color: '#10b981', title: 'Hypothesis Simulation', desc: 'Utilizes agentic code execution to simulate experimental outcomes and synthesize synthetic datasets, allowing for rapid iteration before physical lab work begins.' },
                { id: '03', color: '#f59e0b', title: 'Analytical Workspace', desc: 'A high-density data environment for processing CSVs and complex datasets with real-time visualization, statistical interpretation, and automated insight extraction.' },
                { id: '04', color: '#ec4899', title: 'Peer-Review Protocol', desc: 'Subjects your methodology and findings to a simulated multi-agent peer review process, identifying potential biases, logical fallacies, and areas for empirical strengthening.' },
                { id: '05', color: '#ef4444', title: 'Manuscript Architect', desc: 'Automates the transition from raw data and lab notes to publication-ready drafts, ensuring adherence to scientific standards and proper provenance tracking.' }
              ].map((feature) => (
                <div key={feature.id} className="d-flex gap-4 mb-4 animate-in">
                  <span className="h4 fw-bold font-['Space_Grotesk']" style={{ color: feature.color }}>{feature.id}</span>
                  <div>
                    <h3 className="h6 fw-bold mb-1">{feature.title}</h3>
                    <p className="text-sm text-[#94a3b8] mb-0">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="w-100 w-lg-[500px] d-flex align-items-center justify-content-center p-4 p-lg-5 bg-[#0f172a] position-relative">
          <div className="position-absolute top-50 start-50 translate-middle w-75 h-75 rounded-full blur-[120px]" style={{ background: 'rgba(99, 102, 241, 0.05)' }}></div>
          
          <div className="card w-100 max-w-md border-0 bg-[rgba(30,41,59,0.6)] backdrop-blur-[20px] rounded-3xl p-4 p-lg-5 shadow-2xl border border-[rgba(255,255,255,0.08)]">
            <div className="d-flex mb-5 bg-[#0f172a] p-1 rounded-2xl">
              <button 
                onClick={() => setIsLogin(true)}
                className={`flex-grow-1 py-2 rounded-xl text-xs fw-bold tracking-widest transition-all ${isLogin ? 'bg-[#f8fafc] text-[#0f172a]' : 'text-[#94a3b8]'}`}
              >
                SIGN IN
              </button>
              <button 
                onClick={() => setIsLogin(false)}
                className={`flex-grow-1 py-2 rounded-xl text-xs fw-bold tracking-widest transition-all ${!isLogin ? 'bg-[#f8fafc] text-[#0f172a]' : 'text-[#94a3b8]'}`}
              >
                SIGN UP
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="mb-4">
                  <label className="d-block text-[10px] fw-black text-[#f8fafc] tracking-[0.2em] mb-2 uppercase">Username</label>
                  <input 
                    type="text" 
                    required
                    className="form-control bg-[#0f172a] border-[rgba(255,255,255,0.08)] rounded-2xl py-3 px-4 text-sm focus:border-[#06b6d4] focus:shadow-[0_0_15px_rgba(6,182,212,0.1)] transition-all"
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
                  className="form-control bg-[#0f172a] border-[rgba(255,255,255,0.08)] rounded-2xl py-3 px-4 text-sm focus:border-[#06b6d4] focus:shadow-[0_0_15px_rgba(6,182,212,0.1)] transition-all"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div className="mb-4">
                <label className="d-block text-[10px] fw-black text-[#f8fafc] tracking-[0.2em] mb-2 uppercase">Password</label>
                <input 
                  type="password" 
                  required
                  className="form-control bg-[#0f172a] border-[rgba(255,255,255,0.08)] rounded-2xl py-3 px-4 text-sm focus:border-[#06b6d4] focus:shadow-[0_0_15px_rgba(6,182,212,0.1)] transition-all"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                />
              </div>
              {!isLogin && (
                <div className="mb-4">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <label className="d-block text-[10px] fw-black text-[#f8fafc] tracking-[0.2em] uppercase">Gemini API Key</label>
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-[#06b6d4] text-[10px] fw-bold tracking-widest text-decoration-none hover:text-[#f8fafc]">GET API KEY</a>
                  </div>
                  <input 
                    type="password" 
                    className="form-control bg-[#0f172a] border-[rgba(255,255,255,0.08)] rounded-2xl py-3 px-4 text-sm focus:border-[#06b6d4] focus:shadow-[0_0_15px_rgba(6,182,212,0.1)] transition-all"
                    value={formData.geminiKey}
                    onChange={e => setFormData({...formData, geminiKey: e.target.value})}
                  />
                </div>
              )}

              {error && <p className="text-danger small mb-4">{error}</p>}

              <button 
                type="submit" 
                disabled={loading}
                className="btn w-100 bg-[#f8fafc] text-[#0f172a] fw-black py-3 rounded-2xl tracking-widest hover:bg-[#06b6d4] hover:scale-[1.02] transition-all disabled:opacity-50"
              >
                {loading ? 'PROCESSING...' : (isLogin ? 'AUTHORIZE' : 'INITIALIZE')}
              </button>
            </form>

            <div className="mt-5 text-center">
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
          <div className="card w-100 max-w-lg border-0 bg-[#1e293b] rounded-3xl p-5 shadow-2xl border border-[rgba(255,255,255,0.1)] animate-in">
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
                    className="form-control bg-[#0f172a] border-[rgba(255,255,255,0.08)] rounded-2xl py-3 px-4 text-sm focus:border-[#06b6d4] transition-all"
                    value={waitlistEmail}
                    onChange={e => setWaitlistEmail(e.target.value)}
                  />
                </div>
                {waitlistError && <p className="text-danger text-xs mb-3">{waitlistError}</p>}
                <button 
                  type="submit" 
                  disabled={waitlistStatus === 'loading'}
                  className="btn w-100 bg-[#6366f1] text-white fw-black py-3 rounded-2xl tracking-widest hover:bg-[#4f46e5] transition-all disabled:opacity-50"
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
