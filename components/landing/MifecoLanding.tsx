import React, { useState } from 'react';

interface MifecoLandingProps {
  user: any;
  onOpenDatabase: () => void;
  onInitiateProtocol: () => void;
  onLogout: () => void;
  onKeyUpdate: () => void;
}

export const MifecoLanding: React.FC<MifecoLandingProps> = ({ user, onOpenDatabase, onInitiateProtocol, onLogout, onKeyUpdate }) => {
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('hmap-gemini-api-key') || '');
  const [showKey, setShowKey] = useState(false);

  const handleSaveKey = () => {
    localStorage.setItem('hmap-gemini-api-key', geminiKey);
    onKeyUpdate();
    alert('API Key updated successfully.');
  };

  return (
    <div className="min-vh-100 bg-[#0f172a] text-[#f8fafc] font-['Inter'] p-4 p-lg-5 d-flex flex-column align-items-center justify-content-center" style={{ background: 'radial-gradient(circle at 50% 50%, #1e293b 0%, #0f172a 100%)' }}>
      <div className="w-100 max-w-4xl animate-in">
        {/* Header */}
        <div className="d-flex justify-content-between align-items-end mb-5">
          <div>
            <h1 className="display-4 fw-black font-['Space_Grotesk'] tracking-tighter mb-0">
              Welcome, <span style={{ 
                background: 'linear-gradient(to right, #6366f1, #06b6d4)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>{user?.username || 'Researcher'}</span>
            </h1>
            <p className="text-[#94a3b8] tracking-widest text-xs uppercase mt-2">System Access Level: Alpha-7</p>
          </div>
          <button onClick={onLogout} className="btn btn-outline-danger btn-sm rounded-xl px-3 border-[rgba(255,255,255,0.1)] text-xs">LOGOUT</button>
        </div>

        <div className="row g-4 mb-4">
          <div className="col-lg-8">
            <div className="row g-4 h-100">
              <div className="col-md-6">
                <div className="card h-100 border-0 bg-[rgba(30,41,59,0.6)] backdrop-blur-[20px] rounded-3xl p-4 border border-[rgba(255,255,255,0.08)] hover:translate-y-[-4px] transition-all">
                  <div className="d-flex align-items-center gap-3 mb-4">
                    <div className="p-3 rounded-2xl bg-[rgba(99,102,241,0.1)] text-[#6366f1]">
                      <i className="bi bi-folder2-open h4 mb-0"></i>
                    </div>
                    <div>
                      <h3 className="h6 fw-black tracking-widest mb-1 uppercase">Active Projects</h3>
                      <p className="text-xs text-[#94a3b8] mb-0">Access your research archives</p>
                    </div>
                  </div>
                  <div className="mt-auto">
                    <button onClick={onOpenDatabase} className="btn w-100 bg-[#f8fafc] text-[#0f172a] fw-black py-3 rounded-2xl tracking-widest hover:bg-[#6366f1] hover:text-white transition-all">
                      OPEN DATABASE
                    </button>
                  </div>
                </div>
              </div>
              <div className="col-md-6">
                <div className="card h-100 border-0 bg-[rgba(30,41,59,0.6)] backdrop-blur-[20px] rounded-3xl p-4 border border-[rgba(255,255,255,0.08)] hover:translate-y-[-4px] transition-all">
                  <div className="d-flex align-items-center gap-3 mb-4">
                    <div className="p-3 rounded-2xl bg-[rgba(236,72,153,0.1)] text-[#ec4899]">
                      <i className="bi bi-stars h4 mb-0"></i>
                    </div>
                    <div>
                      <h3 className="h6 fw-black tracking-widest mb-1 uppercase">Create New</h3>
                      <p className="text-xs text-[#94a3b8] mb-0">Initialize discovery protocol</p>
                    </div>
                  </div>
                  <div className="mt-auto">
                    <button onClick={onInitiateProtocol} className="btn w-100 border-2 border-[#ec4899] text-[#ec4899] fw-black py-3 rounded-2xl tracking-widest hover:bg-[#ec4899] hover:text-white transition-all">
                      INITIATE PROTOCOL
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-4">
            {/* AI Config */}
            <div className="card h-100 border-0 bg-[rgba(30,41,59,0.6)] backdrop-blur-[20px] rounded-3xl p-4 border border-[rgba(255,255,255,0.08)]">
              <div className="d-flex align-items-center gap-3 mb-4">
                <div className="p-3 rounded-2xl bg-[rgba(6,182,212,0.1)] text-[#06b6d4]">
                  <i className="bi bi-cpu h4 mb-0"></i>
                </div>
                <div>
                  <h3 className="h6 fw-black tracking-widest mb-1 uppercase">AI Engine</h3>
                  <p className="text-xs text-[#94a3b8] mb-0">Gemini Pro Integration</p>
                </div>
              </div>
              
              <div className="mb-4">
                <label className="d-block text-[10px] fw-black text-[#f8fafc] tracking-[0.2em] mb-2 uppercase">API Key</label>
                <div className="position-relative">
                  <input 
                    type={showKey ? "text" : "password"}
                    className="form-control bg-[#0f172a] border-[rgba(255,255,255,0.08)] rounded-2xl py-3 px-4 text-sm focus:border-[#06b6d4] transition-all"
                    value={geminiKey}
                    onChange={e => setGeminiKey(e.target.value)}
                    placeholder="Enter key..."
                  />
                  <button 
                    onClick={() => setShowKey(!showKey)}
                    className="position-absolute end-0 top-50 translate-middle-y btn btn-link text-[#94a3b8] px-3"
                  >
                    <i className={`bi bi-eye${showKey ? '-slash' : ''}`}></i>
                  </button>
                </div>
              </div>
              
              <button onClick={handleSaveKey} className="btn w-100 bg-[#f8fafc] text-[#0f172a] fw-black py-3 rounded-2xl tracking-widest hover:bg-[#06b6d4] transition-all mb-3">
                SYNC ENGINE
              </button>
              
              <div className="text-center">
                <button className="btn btn-link text-[#06b6d4] text-[10px] fw-bold tracking-widest text-decoration-none p-0">
                  GET API KEY
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Status */}
        <div className="mt-5 d-flex flex-column align-items-center gap-3">
          <div className="d-flex justify-content-center gap-4 text-[10px] font-monospace text-[#94a3b8] opacity-50">
            <span>V.5.0.0-VERIFIED</span>
            <span>|</span>
            <span className="text-success">SYSTEM ONLINE</span>
          </div>
        </div>
      </div>
    </div>
  );
};
