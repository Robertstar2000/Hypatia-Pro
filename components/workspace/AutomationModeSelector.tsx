import React from 'react';

export const AutomationModeSelector = ({ onSelect }) => {
    return (
        <div className="text-center p-4">
            <h4 className="fw-bold">Establish Processing Protocol</h4>
            <p className="text-white-50 mb-4">Select the operational mode for this research arc.</p>
            
            <div className="row g-4 justify-content-center">
                <div className="col-md-5">
                    <div className="card h-100 border-primary border-opacity-25 bg-primary bg-opacity-5">
                        <div className="card-body p-4 d-flex flex-column">
                            <div className="mb-3">
                                <i className="bi bi-person-workspace fs-1 text-primary-glow"></i>
                            </div>
                            <h5 className="fw-bold text-primary-glow">Manual Forensic Control</h5>
                            <p className="small text-white-50 flex-grow-1">
                                PROTOCOL NOTICE: Manual forensic control is recommended for research requiring human oversight. Agentic research is optimized for rapid ideation and assessment of ideas.
                            </p>
                            <button className="btn btn-outline-primary w-100 mt-3" onClick={() => onSelect('manual')}>
                                Engage Manual Mode
                            </button>
                        </div>
                    </div>
                </div>

                <div className="col-md-5">
                    <div className="card h-100 border-secondary border-opacity-25 bg-dark bg-opacity-25">
                        <div className="card-body p-4 d-flex flex-column">
                            <div className="mb-3">
                                <i className="bi bi-cpu-fill fs-1 text-white"></i>
                            </div>
                            <h5 className="fw-bold text-white">Agentic Reconstruction</h5>
                            <p className="small text-white-50 flex-grow-1">
                                The AI Principal Investigator will autonomously execute the remaining steps (Hypothesis to Publication) in a continuous loop.
                            </p>
                            <button className="btn btn-outline-secondary w-100 mt-3" onClick={() => onSelect('automated')}>
                                Start Auto-Sequence
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};