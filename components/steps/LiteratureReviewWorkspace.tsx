
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useExperiment } from '../../services';
import { useToast } from '../../toast';
import { runLiteratureReviewAgent, parseGeminiError, extractJson } from '../../services';
import { GeneratedOutput } from '../common/GeneratedOutput';
import { AgenticAnalysisView } from '../common/AgenticAnalysisView';
import { renderMarkdown } from '../../utils/markdownRenderer';

export const LiteratureReviewWorkspace = ({ onStepComplete }) => {
    const { activeExperiment, updateExperiment, isAuthenticated } = useExperiment();
    const { addToast } = useToast();
    const [agenticRun, setAgenticRun] = useState({
        status: 'idle',
        iterations: 0,
        maxIterations: 5, 
        logs: [],
    });

    const isMounted = useRef(true);
    useEffect(() => () => { isMounted.current = false; }, []);

    const stepData = activeExperiment.stepData[2] || {};

    const performAgenticReview = useCallback(async () => {
        if (!isAuthenticated || agenticRun.status === 'running') return;

        setAgenticRun(prev => ({ ...prev, status: 'running', logs: [], iterations: 0 }));

        try {
            const finalDoc = await runLiteratureReviewAgent({
                experiment: activeExperiment,
                updateLog: (agent, message) => {
                    if (isMounted.current) {
                        setAgenticRun(prev => ({ 
                            ...prev, 
                            logs: [...prev.logs, { agent, message }],
                            iterations: message.includes('searching') ? prev.iterations + 1 : prev.iterations
                        }));
                    }
                }
            });

            if (!isMounted.current) return;

            const finalStepData = { ...stepData, output: finalDoc };
            await updateExperiment({ ...activeExperiment, stepData: { ...activeExperiment.stepData, 2: finalStepData } });
            
            setAgenticRun(prev => ({ ...prev, status: 'success' }));
            addToast("Evidence discovery complete!", "success");

            if (activeExperiment.automationMode === 'automated') {
                setTimeout(() => { if (isMounted.current) onStepComplete(); }, 2000);
            }

        } catch (error) {
            if (!isMounted.current) return;
            const errorMessage = parseGeminiError(error, "Agentic literature review failed.");
            addToast(errorMessage, 'danger');
            setAgenticRun(prev => ({ 
                ...prev, 
                status: 'failed',
                logs: [...prev.logs, { agent: 'System', message: `ERROR: ${errorMessage}` }]
            }));
        }

    }, [activeExperiment, isAuthenticated, addToast, updateExperiment, stepData, agenticRun.status, onStepComplete]);
    
    useEffect(() => {
        if (!stepData.output && agenticRun.status === 'idle') {
            performAgenticReview();
        }
    }, [stepData.output, agenticRun.status, performAgenticReview]); 

    const renderReviewContent = () => {
        if (!stepData.output) return null;
        
        try {
            const data = JSON.parse(extractJson(stepData.output));
            return (
                <div className="lit-review-pro-view animate-in">
                    <div className="mb-4">
                        <h6 className="text-primary-glow fw-bold mb-3 ls-1 text-uppercase small">Synthesis Narrative</h6>
                        <div className="generated-text-container p-3 rounded bg-dark border border-secondary border-opacity-10" 
                             dangerouslySetInnerHTML={{ __html: renderMarkdown(data.synthesis_narrative || '') }} />
                    </div>

                    <div className="row g-4 mb-4">
                        <div className="col-md-6">
                            <h6 className="text-warning fw-bold mb-3 ls-1 text-uppercase small">Identified Gaps</h6>
                            <ul className="list-group list-group-flush border border-secondary border-opacity-10 rounded">
                                {data.evidence_gaps?.map((gap, i) => (
                                    <li key={i} className="list-group-item bg-dark text-white-50 small border-secondary border-opacity-10">
                                        <i className="bi bi-search me-2 text-warning"></i> {gap}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="col-md-6">
                            <h6 className="text-info fw-bold mb-3 ls-1 text-uppercase small">Candidate Mechanisms</h6>
                            <ul className="list-group list-group-flush border border-secondary border-opacity-10 rounded">
                                {data.candidate_mechanisms?.map((mech, i) => (
                                    <li key={i} className="list-group-item bg-dark text-white-50 small border-secondary border-opacity-10">
                                        <i className="bi bi-gear-wide-connected me-2 text-info"></i> {mech}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <h6 className="text-primary-glow fw-bold mb-3 ls-1 text-uppercase small">Grounded References</h6>
                    <div className="row g-3">
                        {data.references?.map((ref, i) => (
                            <div key={i} className="col-lg-6">
                                <div className="card h-100 bg-black border-secondary border-opacity-25 shadow-sm">
                                    <div className="card-body p-3">
                                        <div className="d-flex justify-content-between align-items-start mb-2">
                                            <div className="flex-grow-1 overflow-hidden">
                                                <h6 className="fw-bold text-white small mb-0 text-truncate" title={ref.title}>{ref.title}</h6>
                                                <div className="d-flex gap-2 mt-1">
                                                    {ref.rating && (
                                                        <span className={`badge text-uppercase ${
                                                            ref.rating === 'Seminal' ? 'bg-primary' : 
                                                            ref.rating === 'Contradictory' ? 'bg-danger' : 
                                                            ref.rating === 'Methodological' ? 'bg-info' : 'bg-secondary'
                                                        }`} style={{ fontSize: '0.6rem' }}>
                                                            {ref.rating}
                                                        </span>
                                                    )}
                                                    {ref.relevance_score !== undefined && (
                                                        <span className="text-warning fw-bold" style={{ fontSize: '0.65rem' }}>
                                                            <i className="bi bi-star-fill me-1"></i>
                                                            {(ref.relevance_score * 100).toFixed(0)}% Match
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {ref.year && <span className="badge bg-secondary opacity-50 ms-2">{ref.year}</span>}
                                        </div>
                                        <p className="text-white-50 mb-2" style={{ fontSize: '0.7rem' }}>
                                            {ref.authors?.join(', ')} • {ref.journal || 'Archival Node'}
                                        </p>
                                        <p className="card-text small text-white-50 mb-3 fst-italic">
                                            "{ref.key_findings?.slice(0, 100)}..."
                                        </p>
                                        {ref.url && (
                                            <a href={ref.url} target="_blank" rel="noopener noreferrer" className="btn btn-xs btn-outline-primary w-100">
                                                VIEW GROUNDING <i className="bi bi-box-arrow-up-right ms-1"></i>
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        } catch (e) {
            return <div className="generated-text-container" dangerouslySetInnerHTML={{ __html: renderMarkdown(stepData.output) }} />;
        }
    };

    return (
        <div className="lit-review-container">
            {agenticRun.status !== 'running' && stepData.output && (
                <div className="d-flex justify-content-end mb-3">
                    <button className="btn btn-xs btn-outline-secondary" onClick={performAgenticReview}>
                        <i className="bi bi-arrow-clockwise me-1"></i> RE-SYNC ARCHIVE
                    </button>
                </div>
            )}
            
            {agenticRun.status === 'running' ? (
                <div className="mt-4 border-top border-secondary border-opacity-10 pt-4">
                    <AgenticAnalysisView 
                        agenticRun={agenticRun} 
                        title="Archival Evidence Discovery" 
                        subtitle="Deep-research agents are mapping global indices and verifying citations." 
                    />
                </div>
            ) : renderReviewContent()}
        </div>
    );
};
