
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useExperiment } from '../../services';
import { useToast } from '../../toast';
import { STEP_SPECIFIC_TUNING_PARAMETERS } from '../../config';

export const FineTuneModal = ({ stepId, onClose }) => {
    const { activeExperiment, updateExperiment } = useExperiment();
    const { addToast } = useToast();

    // Handle Escape key to close modal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);
    
    // Defensive initialization for legacy data
    const initialSettings = (activeExperiment.fineTuneSettings && activeExperiment.fineTuneSettings[stepId]) 
        ? activeExperiment.fineTuneSettings[stepId] 
        : {};
        
    const [settings, setSettings] = useState(initialSettings);
    const parameters = STEP_SPECIFIC_TUNING_PARAMETERS[stepId] || [];

    const handleSettingChange = (name, value) => {
        setSettings(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        const currentSettings = activeExperiment.fineTuneSettings || {};
        updateExperiment({
            ...activeExperiment,
            fineTuneSettings: { ...currentSettings, [stepId]: settings }
        });
        addToast("AI settings saved for this step.", "success");
        onClose();
    };

    const handleReset = () => {
        const defaultSettings = {};
        parameters.forEach(p => defaultSettings[p.name] = p.default);
        setSettings(defaultSettings);
        addToast("Settings reset to default.", "info");
    }

    const modalContent = (
        <div
            className="modal show d-block"
            style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 3000 }}
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="fine-tune-modal-title"
        >
            <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
                <div className="modal-content bg-dark border-secondary">
                    <div className="modal-header border-secondary">
                        <h5 id="fine-tune-modal-title" className="modal-title"><i className="bi bi-sliders me-2"></i>Fine-Tune AI for Step {stepId}</h5>
                        <button type="button" className="btn-close btn-close-white" onClick={onClose} aria-label="Close fine-tune settings"></button>
                    </div>
                    <div className="modal-body">
                        {parameters.length > 0 ? parameters.map(param => (
                            <div className="mb-3" key={param.name}>
                                <label htmlFor={param.name} className="form-label fw-bold">{param.label}</label>
                                {param.type === 'select' && (
                                    <select
                                        id={param.name}
                                        className="form-select"
                                        value={settings[param.name] ?? param.default}
                                        onChange={(e) => handleSettingChange(param.name, e.target.value)}
                                    >
                                        {param.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                )}
                                 {param.type === 'range' && (
                                     <div className="d-flex align-items-center">
                                        <input
                                            type="range"
                                            id={param.name}
                                            className="form-range"
                                            min={param.min}
                                            max={param.max}
                                            step={param.step}
                                            value={settings[param.name] ?? param.default}
                                            onChange={(e) => handleSettingChange(param.name, parseFloat(e.target.value))}
                                        />
                                         <span className="ms-2 temperature-slider-label">{settings[param.name]?.toFixed(1) ?? param.default.toFixed(1)}</span>
                                     </div>
                                )}
                                {param.type === 'boolean' && (
                                    <div className="form-check form-switch">
                                        <input
                                            className="form-check-input"
                                            type="checkbox"
                                            id={param.name}
                                            checked={settings[param.name] ?? param.default}
                                            onChange={(e) => handleSettingChange(param.name, e.target.checked)}
                                        />
                                        <label className="form-check-label" htmlFor={param.name}>Enable</label>
                                    </div>
                                )}
                                <div className="form-text">{param.description}</div>
                            </div>
                        )) : <p>No specific tuning parameters available for this step.</p>}
                        
                        <div className="mb-3">
                            <label htmlFor="temperature" className="form-label fw-bold">Temperature</label>
                            <div className="d-flex align-items-center">
                                <input
                                    type="range"
                                    id="temperature"
                                    className="form-range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={settings.temperature ?? 0.7}
                                    onChange={(e) => handleSettingChange('temperature', parseFloat(e.target.value))}
                                />
                                <span className="ms-2 temperature-slider-label">{(settings.temperature ?? 0.7).toFixed(1)}</span>
                            </div>
                            <div className="form-text">Controls randomness. Lower values are more deterministic.</div>
                        </div>

                    </div>
                    <div className="modal-footer border-secondary">
                        <button type="button" className="btn btn-outline-secondary me-auto" onClick={handleReset}>Reset to Defaults</button>
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="button" className="btn btn-primary" onClick={handleSave}>Save Settings</button>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
