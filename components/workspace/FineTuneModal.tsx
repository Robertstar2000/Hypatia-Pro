
import React, { useState } from 'react';
import { useExperiment } from '../../services';
import { useToast } from '../../toast';
import { STEP_SPECIFIC_TUNING_PARAMETERS } from '../../config';

export const FineTuneModal = ({ stepId, onClose }) => {
    const { activeExperiment, updateExperiment } = useExperiment();
    const { addToast } = useToast();
    
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

    return (
        <div className="modal" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title"><i className="bi bi-sliders me-2"></i>Fine-Tune AI for Step {stepId}</h5>
                        <button type="button" className="btn-close" onClick={onClose}></button>
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
                    <div className="modal-footer">
                        <button type="button" className="btn btn-outline-secondary me-auto" onClick={handleReset}>Reset to Defaults</button>
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="button" className="btn btn-primary" onClick={handleSave}>Save Settings</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
