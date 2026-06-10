
import React, { useEffect } from 'react';

export const ModeSelection = ({ onSelect }) => {
    useEffect(() => {
        // Safe check for Bootstrap to prevent runtime crashes
        const bs = (window as any).bootstrap;
        if (!bs || !bs.Tooltip) return;

        const tooltipTriggerList = Array.from(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        const tooltipList = tooltipTriggerList.map(tooltipTriggerEl => new bs.Tooltip(tooltipTriggerEl));
        return () => {
            tooltipList.forEach(tooltip => tooltip.dispose());
        };
    }, []);

    return (
        <div className="container">
            <div className="text-center mb-4">
                <h5 className="fw-bold">Choose Your Data Generation Method</h5>
                <p className="text-white-50">Select one of the following methods to provide data for your experiment.</p>
            </div>
            <div className="row g-3 justify-content-center">
                 <div className="col-md-6 col-lg-4">
                    <div className="card h-100 feature-card p-0">
                        <div className="card-body d-flex flex-column">
                            <div className="feature-icon"><i className="bi bi-upload"></i></div>
                            <h6 className="card-title fw-bold">Upload Your Data</h6>
                            <p className="card-text small text-white-50 flex-grow-1">Upload an existing dataset from your computer. The application will use this data for the analysis step.</p>
                            <button className="btn btn-primary mt-auto" onClick={() => onSelect('upload')}>Select Upload Data</button>
                        </div>
                    </div>
                </div>
                <div className="col-md-6 col-lg-4">
                    <div className="card h-100 feature-card p-0">
                        <div className="card-body d-flex flex-column">
                            <div className="feature-icon"><i className="bi bi-google"></i></div>
                            <h6 className="card-title fw-bold">
                                External Simulation (Colab)
                                <i 
                                    className="bi bi-info-circle-fill ms-2 text-white-50" 
                                    style={{ cursor: 'pointer', fontSize: '0.9rem' }}
                                    data-bs-toggle="tooltip" 
                                    data-bs-placement="top" 
                                    title="Use Google Colab for complex simulations. Connect your Colab notebook to a web app using an Anvil Uplink key (get from Anvil's Server Uplink service). In Colab: !pip install anvil-uplink, then anvil.server.connect('YOUR_KEY'). You can then call Colab functions from your web app. Once done, use 'Upload Your Data' to import results.">
                                </i>
                            </h6>
                            <p className="card-text small text-white-50 flex-grow-1">For complex experiments, use Google Colab. After running your simulation, import your data using the 'Upload' option.</p>
                            <a href="https://colab.research.google.com/" target="_blank" rel="noopener noreferrer" className="btn btn-secondary mt-auto">Open Google Colab <i className="bi bi-box-arrow-up-right"></i></a>
                        </div>
                    </div>
                </div>
                <div className="col-md-6 col-lg-4">
                    <div className="card h-100 feature-card p-0">
                        <div className="card-body d-flex flex-column">
                            <div className="feature-icon"><i className="bi bi-code-slash"></i></div>
                            <h6 className="card-title fw-bold">AI-Generated Simulation</h6>
                            <p className="card-text small text-white-50 flex-grow-1">Have the AI write a JavaScript simulation based on your methodology. You can then run, debug, and edit it.</p>
                            <button className="btn btn-primary mt-auto" onClick={() => onSelect('simulate')}>Select Code Simulation</button>
                        </div>
                    </div>
                </div>
                <div className="col-md-6 col-lg-4">
                     <div className="card h-100 feature-card p-0">
                         <div className="card-body d-flex flex-column">
                            <div className="feature-icon"><i className="bi bi-table"></i></div>
                            <h6 className="card-title fw-bold">Manual Data Entry</h6>
                            <p className="card-text small text-white-50 flex-grow-1">The AI will create a data entry form based on your plan. You can then manually input your results row by row.</p>
                            <button className="btn btn-primary mt-auto" onClick={() => onSelect('manual')}>Select Manual Entry</button>
                        </div>
                    </div>
                </div>
                <div className="col-md-6 col-lg-4">
                     <div className="card h-100 feature-card p-0">
                         <div className="card-body d-flex flex-column">
                            <div className="feature-icon"><i className="bi bi-magic"></i></div>
                            <h6 className="card-title fw-bold">AI Data Synthesis</h6>
                            <p className="card-text small text-white-50 flex-grow-1">Let the AI generate a plausible dataset based on your experiment's context. Ideal for theoretical exploration.</p>
                            <button className="btn btn-primary mt-auto" onClick={() => onSelect('synthesize')}>Select AI Synthesis</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
