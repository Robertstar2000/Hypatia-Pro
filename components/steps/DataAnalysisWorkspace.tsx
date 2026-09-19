
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useExperiment } from '../../services';
import { useToast } from '../../toast';
import { runDataAnalysisAgent, parseGeminiError } from '../../services';
import { GeneratedOutput } from '../common/GeneratedOutput';
import { AgenticAnalysisView } from '../common/AgenticAnalysisView';

export const DataAnalysisWorkspace = ({ onStepComplete, onAnalysisFailure }) => {
    const { activeExperiment, updateExperiment, isAuthenticated } = useExperiment();
    const { addToast } = useToast();
    const [retryCount, setRetryCount] = useState(0);
    const [agenticRun, setAgenticRun] = useState({
        status: 'idle', // 'idle', 'running', 'success', 'failed'
        iterations: 0,
        maxIterations: 2, 
        logs: [],
    });

    const isMounted = useRef(true);
    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    const stepData = activeExperiment.stepData[7] || {};

    const performAgenticAnalysis = useCallback(async (feedback?: string) => {
        if (!isAuthenticated || !stepData.input || agenticRun.status === 'running') return;

        if (feedback) {
            if (retryCount >= 3) {
                addToast("Visualization failed after 3 attempts. Please regenerate manually.", "danger");
                return;
            }
            setRetryCount(prev => prev + 1);
            addToast(`Chart failed, retrying (${retryCount + 1}/3)...`, 'warning');
        } else {
            setRetryCount(0);
        }

        setAgenticRun({ status: 'running', logs: [], iterations: 1, maxIterations: 2 });
        const currentLogs = [];
        const logger = (agent, message) => {
            const entry = { agent, message, timestamp: new Date().toISOString() };
            currentLogs.push(entry);
            if (isMounted.current) {
                setAgenticRun(prev => ({ ...prev, logs: [...prev.logs, entry] }));
            }
        };
        
        try {
            const { finalOutput, blockers, logSummary } = await runDataAnalysisAgent({
                experiment: activeExperiment,
                csvData: stepData.input,
                updateLog: logger,
                feedback: feedback
            });

            if (!isMounted.current) return;

            const finalStepData = { 
                ...stepData, 
                output: finalOutput, 
                suggestedInput: logSummary,
                blockers: [...(stepData.blockers || []), ...blockers],
                agentLogs: currentLogs // Persist logs
            };
            
            await updateExperiment({ ...activeExperiment, stepData: { ...activeExperiment.stepData, 7: finalStepData } });
            
            if (blockers.some(b => b.severity === 'critical')) {
                setAgenticRun(prev => ({ 
                    ...prev, 
                    status: 'failed',
                    logs: [...prev.logs, { agent: 'System', message: 'CRITICAL BLOCKER DETECTED. Analysis halted.', timestamp: new Date().toISOString() }]
                }));
                addToast("Critical blockers detected.", "warning");
            } else {
                setAgenticRun(prev => ({ ...prev, status: 'success', iterations: 2 }));
                addToast("Analysis complete.", "success");
                
                 if (activeExperiment.automationMode === 'automated') {
                     setTimeout(() => { if (isMounted.current) onStepComplete(); }, 1500);
                }
            }
        } catch (error) {
            if (!isMounted.current) return;
            const errorMessage = error instanceof Error ? error.message : parseGeminiError(error);
            
            setAgenticRun(prev => ({ 
                ...prev, 
                status: 'failed',
                logs: [...prev.logs, { agent: 'System', message: `ERROR: ${errorMessage}`, timestamp: new Date().toISOString() }]
            }));

            // Handle strict QA failure - trigger return to Step 6
            if (errorMessage.includes("DATA_QUALITY_FAILURE") || errorMessage.includes("Data Quality Check Failed")) {
                addToast("Dataset rejected by QA Auditor. Re-routing for re-acquisition.", "danger");
                setTimeout(() => {
                    if (isMounted.current) onAnalysisFailure(errorMessage);
                }, 3000);
            } else {
                addToast(errorMessage, "danger");
            }
        }
    }, [activeExperiment, isAuthenticated, addToast, updateExperiment, stepData, agenticRun.status, onStepComplete, onAnalysisFailure, retryCount]);

    // Auto-run trigger
    useEffect(() => {
        if (activeExperiment.automationMode === 'automated' && 
            !stepData.output && 
            stepData.input && 
            agenticRun.status === 'idle') {
            performAgenticAnalysis();
        }
    }, [activeExperiment.automationMode, stepData.output, stepData.input, agenticRun.status, performAgenticAnalysis]);

    return (
        <div className="data-analysis-workspace">
             {!stepData.input ? (
                 <div className="alert alert-warning">
                     <i className="bi bi-exclamation-triangle me-2"></i>
                     No data available for analysis.
                 </div>
             ) : (
                 <>
                    {agenticRun.status !== 'running' && stepData.output && (
                        <div className="d-flex justify-content-end mb-3">
                             <button className="btn btn-sm btn-outline-secondary" onClick={() => performAgenticAnalysis()}>
                                <i className="bi bi-arrow-clockwise me-1"></i> Re-Run Analysis Agent
                            </button>
                        </div>
                    )}

                    {!stepData.output && agenticRun.status === 'idle' && (
                        <div className="text-center p-5 border border-secondary border-opacity-10 rounded-4 bg-dark bg-opacity-10 my-3">
                            <i className="bi bi-graph-up-arrow mb-3 text-primary-glow opacity-50 d-block" style={{ fontSize: '2.5rem' }}></i>
                            <h5 className="fw-bold mb-2">Deploy Analysis Agent</h5>
                            <button className="btn btn-primary px-5 py-2 rounded-pill shadow-sm" onClick={() => performAgenticAnalysis()}>
                                <i className="bi bi-play-fill me-2"></i> Start Analysis
                            </button>
                        </div>
                    )}

                    {agenticRun.status === 'running' ? (
                        <div className="mt-4 border-top border-secondary border-opacity-10 pt-4">
                            <AgenticAnalysisView 
                                agenticRun={agenticRun} 
                                title="Data Scientist Agent Active" 
                                subtitle="Mapping variables and synthesizing visualizations..." 
                            />
                        </div>
                    ) : agenticRun.status === 'failed' ? (
                        <div className="alert alert-danger text-center mt-4">
                            <h6>Analysis protocol aborted.</h6>
                            <p className="text-warning small fw-bold">Human validation required</p>
                            <button className="btn btn-sm btn-outline-danger mt-2" onClick={() => performAgenticAnalysis()}>Re-Initiate</button>
                        </div>
                    ) : (
                        <GeneratedOutput 
                            stepId={7} 
                            onGenerate={performAgenticAnalysis} 
                            isLoading={false} 
                            onError={(error) => performAgenticAnalysis(error)}
                        />
                    )}
                 </>
             )}
        </div>
    );
};
