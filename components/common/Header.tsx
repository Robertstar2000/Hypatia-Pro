
import React, { useState } from 'react';
import { AppMenuModal } from './AppMenuModal';

export const Header = ({ setView, activeView, onToggleNotebook }) => {
    const [showMenu, setShowMenu] = useState(false);

    return (
        <>
            <nav className="navbar navbar-expand-lg navbar-dark sticky-top px-3" style={{ zIndex: 1050 }}>
                <div className="container-fluid">
                    <a className="navbar-brand fw-bold d-flex align-items-center" href="#" onClick={(e) => { e.preventDefault(); setView('landing'); }}>
                        <i className="bi bi-mortarboard-fill me-2 text-primary-glow fs-3"></i>
                        <span className="d-none d-sm-inline">PROJECT HYPATIA</span>
                    </a>
                    
                    <div className="ms-auto d-flex align-items-center">
                        <span className="badge rounded-pill bg-dark border border-secondary border-opacity-25 px-3 py-2 me-3 d-none d-md-inline-block text-white-50">
                             <i className="bi bi-cpu-fill me-1"></i> SYSTEM READY
                        </span>
                        
                        <button 
                            type="button"
                            className="btn btn-link text-white p-2 ms-2 position-relative" 
                            onClick={() => setShowMenu(true)}
                            aria-label="Open System Menu"
                            title="Open System Menu"
                            style={{ fontSize: '1.5rem', transition: 'transform 0.2s', zIndex: 1051, cursor: 'pointer' }}
                            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1.0)'}
                        >
                            <i className="bi bi-grid-3x3-gap-fill"></i>
                        </button>
                    </div>
                </div>
            </nav>

            {showMenu && (
                <AppMenuModal 
                    onClose={() => setShowMenu(false)} 
                    setView={setView} 
                    activeView={activeView} 
                    onToggleNotebook={onToggleNotebook} 
                />
            )}
        </>
    );
};
