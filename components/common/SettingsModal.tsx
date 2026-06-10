
import React from 'react';
import { createPortal } from 'react-dom';
import { getKeyStatus } from '../../services';

interface SettingsModalProps {
    onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
    const keyStatus = getKeyStatus();

    const modalContent = (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 3100 }} onClick={onClose}>
            <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
                <div className="modal-content bg-dark border-secondary">
                    <div className="modal-header border-secondary">
                        <h5 className="modal-title text-primary-glow"><i className="bi bi-gear-fill me-2"></i>Application Settings</h5>
                        <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
                    </div>
                    <div className="modal-body p-4">
                        <div className="mb-4">
                            <label className="form-label text-white-50 small text-uppercase fw-bold">API Connection</label>
                            <div className="p-3 rounded bg-black border border-secondary border-opacity-25 d-flex align-items-center">
                                <div className={`status-dot me-3 ${keyStatus.color}`}></div>
                                <div>
                                    <div className="fw-bold">{keyStatus.label}</div>
                                    <div className="small text-white-50">
                                        {keyStatus.type === 'demo' && 'AI features are simulated.'}
                                        {keyStatus.type === 'env' && 'Secure environment link active.'}
                                        {keyStatus.type === 'manual' && 'Using manually entered key.'}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="mb-4">
                            <label className="form-label text-white-50 small text-uppercase fw-bold">Interface Preferences</label>
                            <div className="form-check form-switch mb-2">
                                <input className="form-check-input" type="checkbox" id="darkModeSwitch" checked readOnly />
                                <label className="form-check-label" htmlFor="darkModeSwitch">Dark Mode (Forced)</label>
                            </div>
                            <div className="form-check form-switch">
                                <input className="form-check-input" type="checkbox" id="streamingSwitch" checked readOnly />
                                <label className="form-check-label" htmlFor="streamingSwitch">Real-time Data Streaming</label>
                            </div>
                        </div>
                        <div className="alert alert-info border-info border-opacity-25 bg-info bg-opacity-10 text-info small">
                            <i className="bi bi-info-circle-fill me-2"></i>
                            Settings are stored locally in your browser's persistent state.
                        </div>
                    </div>
                    <div className="modal-footer border-secondary">
                        <button className="btn btn-primary w-100" onClick={onClose}>CLOSE SETTINGS</button>
                    </div>
                </div>
            </div>
            <style>{`
                .status-dot {
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                }
            `}</style>
        </div>
    );

    return createPortal(modalContent, document.body);
};
