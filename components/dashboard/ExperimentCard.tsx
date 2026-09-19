import React, { memo } from 'react';
import { Experiment } from '../../config';

interface ExperimentCardProps {
    exp: Experiment;
    isArchived?: boolean;
    onArchive: (exp: Experiment) => Promise<void>;
    onUnarchive: (exp: Experiment) => Promise<void>;
    deleteExperiment: (id: string) => Promise<void>;
    selectExperiment: (id: string) => void;
    handleDeployClick: (experiment: Experiment) => void;
    handleExport: (experiment: Experiment) => void;
}

export const ExperimentCard = memo<ExperimentCardProps>(({ 
    exp, 
    isArchived = false, 
    onArchive, 
    onUnarchive, 
    deleteExperiment, 
    selectExperiment, 
    handleDeployClick, 
    handleExport 
}) => (
    <div className={`col-md-6 col-lg-4 mb-4`}>
        <div className={`card h-100 d-flex flex-column ${isArchived ? 'archived-project-card' : 'shadow-sm border-secondary border-opacity-25'}`}>
            <div className="card-body flex-grow-1">
                <div className="d-flex justify-content-between align-items-start mb-2">
                    <h5 className="card-title text-primary-glow mb-0 text-truncate w-75" title={exp.title}>{exp.title}</h5>
                    {isArchived && <span className="badge bg-secondary opacity-50">ARCHIVED</span>}
                </div>
                <h6 className="card-subtitle mb-3 text-muted small">{exp.field}</h6>
                <p className="card-text text-white-50 small" style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                }}>{exp.description}</p>
            </div>
            <div className="card-footer bg-transparent border-top-0 pt-0">
                <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="small text-white-50">Step {exp.currentStep}/10</span>
                    <span className="small text-white-50">{new Date(exp.updatedAt || exp.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="progress mb-3 bg-dark" style={{ height: '4px' }}>
                    <div className="progress-bar bg-primary-glow" style={{ width: `${Math.min(exp.currentStep * 10, 100)}%` }}></div>
                </div>
                
                {isArchived ? (
                    <div className="btn-group w-100" role="group">
                         <button className="btn btn-sm btn-outline-light" onClick={() => selectExperiment(exp.id)}>
                            <i className="bi bi-eye me-1"></i> View
                        </button>
                        <button className="btn btn-sm btn-outline-light" onClick={() => onUnarchive(exp)}>
                             <i className="bi bi-box-arrow-in-up me-1"></i> Restore
                        </button>
                         <button className="btn btn-sm btn-outline-danger" onClick={() => deleteExperiment(exp.id)}>
                            <i className="bi bi-trash"></i>
                        </button>
                    </div>
                ) : (
                    <div className="d-flex flex-column gap-2">
                        {exp.currentStep >= 10 && exp.stepData[10]?.output ? (
                            <button className="btn btn-sm btn-success w-100" onClick={() => handleDeployClick(exp)}>
                                <i className="bi bi-send-check-fill me-1"></i> Finalize & Deploy
                            </button>
                        ) : (
                            <button className="btn btn-sm btn-primary w-100" onClick={() => selectExperiment(exp.id)}>
                                <i className="bi bi-play-circle-fill me-1"></i> Continue Research
                            </button>
                        )}
                        <div className="d-flex gap-2">
                            <button className="btn btn-sm btn-outline-secondary flex-grow-1" onClick={() => handleExport(exp)} title="Export JSON">
                                <i className="bi bi-download"></i>
                            </button>
                            <button className="btn btn-sm btn-outline-secondary flex-grow-1" onClick={() => onArchive(exp)} title="Archive">
                                <i className="bi bi-archive"></i>
                            </button>
                            <button className="btn btn-sm btn-outline-danger flex-grow-1" onClick={() => deleteExperiment(exp.id)} title="Delete">
                                <i className="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
));