
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useExperiment } from '../../services';
import { useToast } from '../../toast';
import { runInterpretationAgent, parseGeminiError } from '../../services';
import { AgenticAnalysisView } from '../common/AgenticAnalysisView';
import { renderMarkdown } from '../../utils/markdownRenderer';

export const InterpretationWorkspace = ({ onStepComplete }) => {
    const { activeExperiment, updateExperiment, isAuthenticated } = useExperiment();
    const { addToast } = useToast();
    const [agenticRun, setAgenticRun] = useState({
        status: 'idle',
        iterations: 0,
        maxIterations: 3, 
        logs: [],
    });

    const isMounted = useRef(true);
    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    const stepData = activeExperiment.stepData[8] || {};

    const performAgenticInterpretation = useCallback(async () => {
        if (!isAuthenticated || agenticRun.status === 'running') return;

        setAgenticRun(prev => ({ ...prev, status: 'running', logs: [], iterations: 1 }));

        try {
            const { finalOutput, blockers } = await runInterpretationAgent({
                experiment: activeExperiment,
                updateLog: (agent, message) => {
                    if (isMounted.current) {
                        setAgenticRun(prev => ({
                            ...prev,
                            logs: [...prev.logs, { agent, message }]
                        }));
                    }
                }
            });

            if (!isMounted.current) return;

            const finalStepData = { 
                ...stepData, 
                output: finalOutput,
                blockers: [...(stepData.blockers || []), ...blockers]
            };
            
            await updateExperiment({ ...activeExperiment, stepData: { ...activeExperiment.stepData, 8: finalStepData } });
            
            if (blockers.some(b => b.severity === 'critical')) {
                setAgenticRun(prev => ({ 
                    ...prev, 
                    status: 'failed',
                    logs: [...prev.logs, { agent: 'System', message: 'CRITICAL LIMITATIONS DETECTED. PI Review required.' }]
                }));
                addToast("Critical blockers identified in conclusion.", "warning");
            } else {
                setAgenticRun(prev => ({ ...prev, status: 'success', iterations: 3 }));
                addToast("Interpretation verified.", "success");
                
                 if (activeExperiment.automationMode === 'automated') {
                     // Trigger step completion to advance to Step 9
                     setTimeout(() => { if (isMounted.current) onStepComplete(); }, 1500);
                }
            }
        } catch (error) {
            if (!isMounted.current) return;
            const errorMessage = parseGeminiError(error, "Interpretation failure.");
            addToast(errorMessage, 'danger');
            setAgenticRun(prev => ({ 
                ...prev, 
                status: 'failed',
                logs: [...prev.logs, { agent: 'System', message: `ERROR: ${errorMessage}` }]
            }));
        }

    }, [activeExperiment, isAuthenticated, addToast, updateExperiment, stepData, agenticRun.status, onStepComplete]);
    
    useEffect(() => {
        // Automatically start if in automated mode and no output yet
        if (activeExperiment.automationMode === 'automated' && !stepData.output && agenticRun.status === 'idle') {
            performAgenticInterpretation();
        }
    }, [activeExperiment.automationMode, stepData.output, agenticRun.status, performAgenticInterpretation]);

    return (
        <div className="interpretation-workspace">
            {agenticRun.status === 'running' ? (
                <div className="mt-4 border-top border-secondary border-opacity-10 pt-4">
                    <AgenticAnalysisView 
                        agenticRun={agenticRun} 
                        title="Interpretation Node Active" 
                        subtitle="Synthesis agents are evaluating statistical significance and robustness."
                    />
                </div>
            ) : agenticRun.status === 'failed' ? (
                <div className="alert alert-danger text-center mt-4">
                    <h6>Interpretation protocol aborted.</h6>
                    <p className="text-warning small fw-bold">Human validation required</p>
                    <button className="btn btn-sm btn-outline-danger mt-2" onClick={performAgenticInterpretation}>Re-Initiate</button>
                </div>
            ) : (
                <div className="interpretation-pro-view animate-in">
                    {!stepData.output && (
                        <div className="text-center p-5">
                            <i className="bi bi-award mb-3 text-primary-glow opacity-50 d-block" style={{ fontSize: '2.5rem' }}></i>
                            <h5 className="fw-bold">Generate Interpretation</h5>
                            <button className="btn btn-primary px-5 mt-3" onClick={performAgenticInterpretation}>Start Interpretation Agent</button>
                        </div>
                    )}
                    {stepData.output && (
                        <>
                            <div className="d-flex justify-content-end mb-3">
                                <button className="btn btn-xs btn-outline-secondary" onClick={performAgenticInterpretation}>RE-INTERPRET</button>
                            </div>
                            <div className="generated-text-container" dangerouslySetInnerHTML={{ __html: renderMarkdown(stepData.output || '') }} />
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
