
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useExperiment } from '../../services';
import { useToast } from '../../toast';
import { runPeerReviewAgent, parseGeminiError } from '../../services';
import { GeneratedOutput } from '../common/GeneratedOutput';
import { AgenticAnalysisView } from '../common/AgenticAnalysisView';
import { renderMarkdown } from '../../utils/markdownRenderer';

export const PeerReviewWorkspace = ({ onStepComplete }) => {
    const { activeExperiment, updateExperiment, isAuthenticated } = useExperiment();
    const { addToast } = useToast();
    const [agenticRun, setAgenticRun] = useState({
        status: 'idle',
        iterations: 0,
        maxIterations: 7, 
        logs: [],
    });

    const isMounted = useRef(true);
    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    const stepData = activeExperiment.stepData[9] || {};

    const performAgenticReview = useCallback(async () => {
        if (!isAuthenticated || agenticRun.status === 'running') return;

        setAgenticRun(prev => ({ ...prev, status: 'running', logs: [], iterations: 0 }));

        try {
            const finalDoc = await runPeerReviewAgent({
                experiment: activeExperiment,
                updateLog: (agent, message) => {
                    if (isMounted.current) {
                        setAgenticRun(prev => ({
                            ...prev,
                            logs: [...prev.logs, { agent, message }],
                            iterations: message.startsWith('Analyzing Step') ? prev.iterations + 1 : prev.iterations
                        }));
                    }
                }
            });

            if (!isMounted.current) return;

            const finalStepData = { ...stepData, output: finalDoc };
            await updateExperiment({ ...activeExperiment, stepData: { ...activeExperiment.stepData, 9: finalStepData } });
            
            setAgenticRun(prev => ({ ...prev, status: 'success' }));
            addToast("Adversarial audit complete!", "success");

        } catch (error) {
            if (!isMounted.current) return;
            const errorMessage = parseGeminiError(error, "Agentic peer review failed.");
            addToast(errorMessage, 'danger');
            setAgenticRun(prev => ({ 
                ...prev, 
                status: 'failed',
                logs: [...prev.logs, { agent: 'System', message: `ERROR: ${errorMessage}`}]
            }));
        }

    }, [activeExperiment, isAuthenticated, addToast, updateExperiment, stepData, agenticRun.status]);
    
    useEffect(() => {
        if (!stepData.output && agenticRun.status === 'idle') {
            performAgenticReview();
        }
    }, [stepData.output, agenticRun.status, performAgenticReview]);

    return (
        <div className="peer-review-container">
            {agenticRun.status === 'running' ? (
                <div className="mt-4 border-top border-secondary border-opacity-10 pt-4">
                    <AgenticAnalysisView 
                        agenticRun={agenticRun} 
                        title="Adversarial Logic Audit" 
                        subtitle="Multi-persona agents are challenging every claim in the project archive."
                    />
                </div>
            ) : (
                <div className="peer-review-pro-view animate-in">
                    <div className="alert alert-dark border-secondary border-opacity-25 mb-4 p-3 d-flex align-items-center">
                        <div className="me-3 p-2 rounded-circle bg-primary bg-opacity-10 text-primary-glow">
                            <i className="bi bi-shield-lock-fill fs-4"></i>
                        </div>
                        <div>
                            <h6 className="mb-0 fw-bold">Audit Report Generated</h6>
                            <p className="text-white-50 small mb-0">Adversarial agents have completed their critique of your research logic.</p>
                        </div>
                        <button className="btn btn-sm btn-outline-secondary ms-auto" onClick={performAgenticReview}>RE-AUDIT</button>
                    </div>

                    <div className="generated-text-container" dangerouslySetInnerHTML={{ __html: renderMarkdown(stepData.output || '') }} />
                    
                    <div className="mt-5 p-4 rounded bg-danger bg-opacity-5 border border-danger border-opacity-10">
                        <h6 className="text-danger fw-bold mb-3 ls-1 text-uppercase small">Integrity Check</h6>
                        <p className="small text-white-50 mb-0">
                            <strong>Note:</strong> Peer review agents are programmed for skepticism. "Minor" issues often indicate areas where your final publication requires additional precision or caveating.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
