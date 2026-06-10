
import React, { useState, useEffect } from 'react';
import { useExperiment } from '../../services';
import { useToast } from '../../toast';

export const LabNotebook = ({ isOpen, onClose }) => {
    const { activeExperiment, updateExperiment } = useExperiment();
    const [content, setContent] = useState(activeExperiment?.labNotebook || '');
    const { addToast } = useToast();

    const experimentTemplate = `\n\n### EXPERIMENT OBSERVATION LOG\n\n*   **Date:** \n*   **Variable Changes:** \n*   **Anomalies:** \n*   **Initial Thoughts:** \n\n---\n\n`;

    useEffect(() => {
        setContent(activeExperiment?.labNotebook || '');
    }, [activeExperiment?.labNotebook, isOpen]);

    const handleInsertTemplate = () => {
        setContent(prev => prev + experimentTemplate);
        addToast("Observation template inserted.", "info");
    };

    const handleSave = () => {
        if (activeExperiment) {
            updateExperiment({ ...activeExperiment, labNotebook: content });
            addToast("Lab notebook updated.", "success");
            onClose();
        }
    };
    
    return (
         <div className={`lab-notebook-drawer ${isOpen ? 'open' : ''}`}>
            <div className="lab-notebook-header d-flex justify-content-between align-items-center p-3 border-bottom border-secondary">
                <h5 className="mb-0 fw-bold"><i className="bi bi-journal-bookmark me-2 text-primary-glow"></i>Lab Notebook</h5>
                <div>
                    <button className="btn btn-outline-primary btn-sm me-2" onClick={handleInsertTemplate} title="Insert Observation Template">
                        Insert Template
                    </button>
                    <button className="btn btn-primary btn-sm me-2" onClick={handleSave}>Save</button>
                    <button className="btn btn-outline-secondary btn-sm" onClick={onClose}><i className="bi bi-x-lg"></i></button>
                </div>
            </div>
            <div className="lab-notebook-body p-0">
                <textarea 
                    className="form-control lab-notebook-textarea border-0 rounded-0 p-3 h-100" 
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Record your thoughts, observations, and ideas during the discovery process..."
                    style={{ minHeight: 'calc(100vh - 60px)', backgroundColor: 'transparent', resize: 'none' }}
                />
            </div>
        </div>
    );
};
