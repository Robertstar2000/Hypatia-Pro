import React, { useState, useEffect, useRef } from 'react';
import { useExperiment } from '../../services';
import { useToast } from '../../toast';

export const LabNotebook = ({ isOpen, onClose }) => {
    const { activeExperiment, updateExperiment } = useExperiment();
    const [content, setContent] = useState(activeExperiment?.labNotebook || '');
    const { addToast } = useToast();
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const experimentTemplate = `\n\n### EXPERIMENT OBSERVATION LOG\n\n*   **Date:** \n*   **Variable Changes:** \n*   **Anomalies:** \n*   **Initial Thoughts:** \n\n---\n\n`;

    useEffect(() => {
        setContent(activeExperiment?.labNotebook || '');
        if (isOpen) {
            setTimeout(() => textareaRef.current?.focus(), 50);
        }
    }, [activeExperiment?.labNotebook, isOpen]);

    const handleSave = () => {
        if (activeExperiment) {
            updateExperiment({ ...activeExperiment, labNotebook: content });
            addToast("Lab notebook updated.", "success");
            onClose();
        }
    };

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                handleSave();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, activeExperiment, content]);

    const handleInsertTemplate = () => {
        setContent(prev => prev + experimentTemplate);
        addToast("Observation template inserted.", "info");
    };

    return (
        <div
            className={`lab-notebook-drawer ${isOpen ? 'open' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label="Lab Notebook"
            aria-hidden={!isOpen}
        >
            <div className="lab-notebook-header d-flex justify-content-between align-items-center p-3 border-bottom border-secondary">
                <h5 className="mb-0 fw-bold"><i className="bi bi-journal-bookmark me-2 text-primary-glow"></i>Lab Notebook</h5>
                <div>
                    <button
                        className="btn btn-outline-primary btn-sm me-2"
                        onClick={handleInsertTemplate}
                        title="Insert Observation Template"
                        aria-label="Insert observation template"
                    >
                        Insert Template
                    </button>
                    <button
                        className="btn btn-primary btn-sm me-2"
                        onClick={handleSave}
                        title="Save notes (Ctrl+S / Cmd+S)"
                        aria-label="Save lab notebook notes (Ctrl+S)"
                    >
                        Save <span className="opacity-75 small ms-1 d-none d-sm-inline">(Ctrl+S)</span>
                    </button>
                    <button className="btn btn-outline-secondary btn-sm" onClick={onClose} title="Close Lab Notebook" aria-label="Close Lab Notebook"><i className="bi bi-x-lg"></i></button>
                </div>
            </div>
            <div className="lab-notebook-body p-0">
                <textarea
                    ref={textareaRef}
                    id="lab-notebook-textarea"
                    aria-label="Lab Notebook observations and notes"
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
