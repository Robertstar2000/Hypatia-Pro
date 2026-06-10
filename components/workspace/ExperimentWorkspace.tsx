import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useExperiment } from '../../services';
import { useToast } from '../../toast';
import { 
    parseGeminiError, 
    getStepContext, 
    getPromptForStep, 
    executeStepWorkflow, 
    callGeminiStreamWithRetry,
    generateNodeSummary,
    safeGetText
} from '../../services';
import { WORKFLOW_STEPS, RESEARCH_QUESTION_SCHEMA, DATA_ANALYSIS_IMAGE_OUTPUT_SCHEMA, LITERATURE_REVIEW_SCHEMA } from '../../config';

import { ExperimentRunner } from '../steps/runner/ExperimentRunner';
import { DataAnalysisWorkspace } from '../steps/DataAnalysisWorkspace';
import { PublicationExporter } from '../steps/PublicationExporter';
import { EditableStepInput } from '../steps/EditableStepInput';
import { GeneratedOutput } from '../common/GeneratedOutput';
import { ProjectCompletionView } from './ProjectCompletionView';
import { AutomationModeSelector } from './AutomationModeSelector';
import { FineTuneModal } from './FineTuneModal';
import { LiteratureReviewWorkspace } from '../steps/LiteratureReviewWorkspace';
import { PeerReviewWorkspace } from '../steps/PeerReviewWorkspace';
import { InterpretationWorkspace } from '../steps/InterpretationWorkspace';
import { BlockerDisplay } from './BlockerDisplay';

export const ExperimentWorkspace = () => {
    const { activeExperiment, updateExperiment, isAuthenticated } = useExperiment();
    const { addToast } = useToast();

    const [activeStep, setActiveStep] = useState(activeExperiment?.currentStep || 1);
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string>(""); 
    
    const [isVerifying, setIsVerifying] = useState(false);
    const [fineTuneModalOpen, setFineTuneModalOpen] = useState(false);
    const [streamingText, setStreamingText] = useState<string | null>(null);
    const [automationPaused, setAutomationPaused] = useState(false);
    const [reviewCountdown, setReviewCountdown] = useState<number | null>(null);

    // Responsive State
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
    const [isMobile, setIsMobile] = useState(false);

    const streamBuffer = useRef("");
    const streamInterval = useRef<any>(null);
    const isMounted = useRef(true);
    const lastAutomationTick = useRef<number>(0);
    const countdownInterval = useRef<any>(null);
    const activeStepRef = useRef(activeStep);

    useEffect(() => {
        isMounted.current = true;
        const checkMobile = () => {
            const mobile = window.innerWidth < 992;
            setIsMobile(mobile);
            if (mobile) setIsSidebarExpanded(false);
            else setIsSidebarExpanded(true);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);

        return () => { 
            isMounted.current = false;
            window.removeEventListener('resize', checkMobile);
            if (streamInterval.current) clearInterval(streamInterval.current);
            if (countdownInterval.current) clearInterval(countdownInterval.current);
        };
    }, []);

    // Sync ref for stale closure prevention
    useEffect(() => {
        activeStepRef.current = activeStep;
    }, [activeStep]);

    useEffect(() => {
        if (activeExperiment && activeExperiment.currentStep !== activeStep && !isLoading && !isVerifying) {
            setActiveStep(activeExperiment.currentStep);
            setAutomationPaused(false); 
            setReviewCountdown(null);
            setStatusMessage("");
        }
    }, [activeExperiment?.currentStep, isLoading, isVerifying, activeStep]);

    // Countdown Timer
    useEffect(() => {
        if (reviewCountdown !== null && reviewCountdown > 0) {
            if (countdownInterval.current) clearInterval(countdownInterval.current);
            countdownInterval.current = setInterval(() => {
                setReviewCountdown(prev => (prev !== null && prev > 0) ? prev - 1 : null);
            }, 1000);
        } else if (reviewCountdown === 0) {
            setReviewCountdown(null);
            if (countdownInterval.current) clearInterval(countdownInterval.current);
            handleCompleteStep();
        }
        return () => { if (countdownInterval.current) clearInterval(countdownInterval.current); };
    }, [reviewCountdown]);

    // Automation Engine
    useEffect(() => {
        if (!activeExperiment || !isAuthenticated || isLoading || isVerifying || automationPaused || reviewCountdown !== null) return;
        
        const mode = activeExperiment.automationMode;
        if (mode === 'automated' && activeStep === activeExperiment.currentStep) {
            const now = Date.now();
            if (now - lastAutomationTick.current < 5000) return;
            lastAutomationTick.current = now;

            const stepData = (activeExperiment.stepData && activeExperiment.stepData[activeStep]) || {};
            const isAgenticStep = [2, 6, 7, 8, 9, 10].includes(activeStep);
            
            const hasCriticalBlockers = stepData?.blockers?.some(b => b.severity === 'critical' && !b.resolved);
            if (hasCriticalBlockers) {
                setAutomationPaused(true);
                addToast("Automation paused: Critical blockers detected.", "warning");
                return;
            }

            if (!stepData?.output && !isAgenticStep) {
                handleGenerate();
            } else if (stepData?.output && !stepData?.summary && !isAgenticStep) {
                setReviewCountdown(15);
            }
        }
    }, [activeExperiment, activeStep, isAuthenticated, isLoading, isVerifying, automationPaused, reviewCountdown, addToast]);

    const handleStepChange = useCallback((stepId: number) => {
        if (isLoading || isVerifying) return;
        setStreamingText(null);
        setActiveStep(stepId);
        setAutomationPaused(false);
        setReviewCountdown(null);
        if (isMobile) setIsSidebarExpanded(false);
    }, [isLoading, isVerifying, isMobile]);

    const handleResolveBlocker = async (blockerId: string) => {
        if (!activeExperiment) return;
        const stepData = { ...(activeExperiment.stepData || {}) };
        const currentStepData = { ...(stepData[activeStep] || {}) };
        const blockers = (currentStepData.blockers || []).map(b => 
            b.id === blockerId ? { ...b, resolved: true } : b
        );
        stepData[activeStep] = { ...currentStepData, blockers };
        await updateExperiment({ ...activeExperiment, stepData });
        addToast("Blocker mitigation logged.", "success");
    };

    const handleAnalysisFailure = useCallback(async (errorMsg: string) => {
        if (!activeExperiment) return;
        if (errorMsg.includes("DATA_QUALITY_FAILURE")) {
            addToast(`Data quality failed: Re-routing to Acquisition.`, "warning");
            const updatedStepData = { ...activeExperiment.stepData };
            updatedStepData[7] = { ...updatedStepData[7], output: undefined, summary: undefined };
            updatedStepData[6] = { ...updatedStepData[6], output: undefined, summary: undefined };
            await updateExperiment({ ...activeExperiment, currentStep: 6, stepData: updatedStepData });
            setActiveStep(6);
        } else {
             addToast(`Analysis error: ${errorMsg}`, "danger");
             if (activeExperiment.automationMode === 'automated') setAutomationPaused(true);
        }
    }, [activeExperiment, updateExperiment, addToast]);

    const handleGenerate = async (regenerateFeedback = '') => {
        if (!isAuthenticated || isLoading || isVerifying) return;
        setStreamingText(null);
        setIsLoading(true);
        setStatusMessage("Establishing secure archival link...");
        setReviewCountdown(null);
        streamBuffer.current = "";
        
        try {
            const context = await getStepContext(activeExperiment, activeStep);
            const input = (activeExperiment.stepData && activeExperiment.stepData[activeStep]?.input) || '';
            const stepSettings = activeExperiment.fineTuneSettings?.[activeStep] || {};
            const { basePrompt, expectJson, config } = getPromptForStep(activeStep, input, context, stepSettings, regenerateFeedback);
            
            const apiOptions = {
                onStatusUpdate: (msg: string) => {
                    if (isMounted.current) setStatusMessage(msg);
                }
            };

            if (expectJson) {
                const schema = (activeStep === 1) ? RESEARCH_QUESTION_SCHEMA : (activeStep === 2) ? LITERATURE_REVIEW_SCHEMA : DATA_ANALYSIS_IMAGE_OUTPUT_SCHEMA;
                const model = activeStep === 1 ? 'gemini-3.1-pro-preview' : 'gemini-3-flash-preview';
                
                const output = await executeStepWorkflow(model, { contents: basePrompt, config }, context, true, schema);
                
                if (isMounted.current) {
                    await updateExperiment({ 
                        ...activeExperiment, 
                        stepData: { ...activeExperiment.stepData, [activeStep]: { ...(activeExperiment.stepData?.[activeStep] || {}), output } } 
                    });
                }
            } else {
                const stream = await callGeminiStreamWithRetry(
                    'gemini-3-flash-preview', 
                    { contents: basePrompt, config },
                    apiOptions
                );
                
                if (streamInterval.current) clearInterval(streamInterval.current);
                streamInterval.current = setInterval(() => { if (isMounted.current) setStreamingText(streamBuffer.current); }, 250);
                
                for await (const chunk of stream) { 
                    streamBuffer.current += (safeGetText(chunk) || ''); 
                }
                
                if (streamInterval.current) { clearInterval(streamInterval.current); streamInterval.current = null; }
                if (isMounted.current) {
                    const finalOutput = streamBuffer.current;
                    setStreamingText(finalOutput);
                    await updateExperiment({
                        ...activeExperiment,
                        stepData: { ...activeExperiment.stepData, [activeStep]: { ...(activeExperiment.stepData?.[activeStep] || {}), output: finalOutput } }
                    });
                }
            }
            if (isMounted.current) addToast("Archival node synchronized.", "success");
        } catch (error) {
            if (isMounted.current) {
                addToast(parseGeminiError(error), 'danger');
                if (activeExperiment?.automationMode === 'automated') setAutomationPaused(true);
            }
        } finally {
            if (isMounted.current) {
                setIsLoading(false);
                setStatusMessage("");
            }
        }
    };
    
    const handleCompleteStep = async (stepDataOverride?: any) => {
        if (isVerifying || !activeExperiment) return;
        setIsVerifying(true);
        setStatusMessage("Verifying node integrity...");
        setReviewCountdown(null);
        
        const currentStepData = { ...(activeExperiment.stepData?.[activeStep] || {}), ...stepDataOverride };
        const currentOutput = currentStepData.output || "";
        const hasCriticalBlockers = currentStepData.blockers?.some(b => b.severity === 'critical' && !b.resolved);
        
        if (hasCriticalBlockers) {
            addToast("Resolve critical blockers before proceeding.", "warning");
            setAutomationPaused(true);
            setIsVerifying(false);
            return;
        }
        
        try {
            let summary = currentStepData.summary;
            if (!summary && currentOutput.length > 50) {
                try { summary = await generateNodeSummary(currentOutput, activeExperiment.field); } catch (e) { summary = "Node verified."; }
            } else if (!summary) { summary = "Node verified."; }

            const nextStepId = activeStep < WORKFLOW_STEPS.length ? activeStep + 1 : activeStep;
            const updatedStepDataMap = { ...(activeExperiment.stepData || {}) };
            updatedStepDataMap[activeStep] = { ...currentStepData, summary };

            if (activeStep === 6) {
                const csvData = currentStepData.input || currentOutput; 
                updatedStepDataMap[7] = { ...(updatedStepDataMap[7] || {}), input: csvData, output: undefined, summary: undefined };
            }

            const updatedExp = { ...activeExperiment, stepData: updatedStepDataMap, currentStep: nextStepId };
            await updateExperiment(updatedExp);
            if (isMounted.current) {
                addToast(`Step ${activeStep} complete.`, "success");
                setActiveStep(nextStepId);
                
                // Force automation to resume immediately if applicable
                if (activeExperiment.automationMode === 'automated') {
                    setAutomationPaused(false);
                    lastAutomationTick.current = 0; // Reset tick to trigger immediate effect
                }

                // Ensure sidebar is expanded to show progress
                if (!isMobile) setIsSidebarExpanded(true);
            }
        } catch (error) {
            console.error(error);
            if (isMounted.current) addToast("Verification failed.", 'danger');
        } finally {
            if (isMounted.current) {
                setIsVerifying(false);
                setStatusMessage("");
            }
        }
    };

    // Safe handler to prevent stale closures from previous steps triggering countdown on new steps
    const handleAutoAdvance = (requestingStepId: number) => {
        if (activeStepRef.current === requestingStepId) {
            setReviewCountdown(15);
        }
    };

    const renderStepContent = () => {
        if (!activeExperiment) return null;
        if (activeStep > WORKFLOW_STEPS.length) return <ProjectCompletionView />;
        if (activeExperiment.currentStep === 2 && activeExperiment.automationMode === null) {
            return <AutomationModeSelector onSelect={(mode) => updateExperiment({...activeExperiment, automationMode: mode})} />;
        }
        
        if (activeStep === 2) return <LiteratureReviewWorkspace onStepComplete={() => handleAutoAdvance(2)} />;
        if (activeStep === 6) return <ExperimentRunner onStepComplete={(data: any) => { handleCompleteStep(data); }} />;
        if (activeStep === 7) return <DataAnalysisWorkspace onStepComplete={() => handleAutoAdvance(7)} onAnalysisFailure={handleAnalysisFailure} />;
        if (activeStep === 8) return <InterpretationWorkspace onStepComplete={() => handleAutoAdvance(8)} />;
        if (activeStep === 9) return <PeerReviewWorkspace onStepComplete={() => handleAutoAdvance(9)} />;
        if (activeStep === 10) return <PublicationExporter />;

        return (
            <div className="discovery-view">
                {activeStep === 1 && <EditableStepInput stepId={1} />}
                <GeneratedOutput
                    key={`${activeExperiment.id}-${activeStep}`}
                    stepId={activeStep}
                    onGenerate={handleGenerate}
                    isLoading={isLoading}
                    statusMessage={statusMessage} 
                    streamingText={streamingText}
                />
            </div>
        );
    };

    if (!activeExperiment) return null;

    const currentStepData = activeExperiment.stepData?.[activeStep];
    const hasOutput = currentStepData?.output;
    const hasCriticalBlocker = currentStepData?.blockers?.some(b => b.severity === 'critical' && !b.resolved);

    return (
        <div className="workspace-container">
            <aside className="sidebar-nav">
                <div className="card shadow-sm border-secondary border-opacity-10 overflow-hidden">
                    <div 
                        className="card-header fw-bold bg-dark py-3 small ls-1 text-uppercase d-flex justify-content-between align-items-center"
                        onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                        style={{ cursor: 'pointer' }}
                    >
                        <span><i className="bi bi-cpu-fill text-primary-glow me-2"></i> Timeline</span>
                        {isMobile && <i className={`bi bi-chevron-${isSidebarExpanded ? 'up' : 'down'}`}></i>}
                    </div>
                    {isSidebarExpanded && (
                        <ul className="list-group list-group-flush">
                            {WORKFLOW_STEPS.map(step => (
                                <li
                                    key={step.id}
                                    className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center py-3 ${activeStep === step.id ? 'active' : ''} ${step.id > activeExperiment.currentStep ? 'disabled' : ''}`}
                                    onClick={() => handleStepChange(step.id)}
                                    style={{ cursor: (step.id <= activeExperiment.currentStep && !isLoading && !isVerifying) ? 'pointer' : 'default' }}
                                >
                                    <div className="d-flex align-items-center gap-2 flex-grow-1">
                                        <span className="small font-mono">{step.id}.</span>
                                        <span className="small">{step.title}</span>
                                        {((isLoading || isVerifying) && activeStep === step.id) && (
                                            <div className="spinner-border spinner-border-sm text-primary-glow" role="status"></div>
                                        )}
                                    </div>
                                    {activeExperiment.currentStep > step.id && <i className="bi bi-check-circle-fill text-success"></i>}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </aside>

            <main className="content-area">
                <div className="card shadow-sm border-secondary border-opacity-25 position-relative overflow-hidden">
                    {(isLoading || isVerifying || reviewCountdown !== null) && (
                        <div className="progress rounded-0" style={{ height: '4px', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100 }}>
                            <div className={`progress-bar progress-bar-striped progress-bar-animated ${reviewCountdown !== null ? 'bg-info' : 'bg-primary-glow'}`} 
                                 style={{ width: reviewCountdown !== null ? `${(reviewCountdown / 15) * 100}%` : '100%' }}></div>
                        </div>
                    )}
                    <div className="card-body p-4" style={{ minHeight: '60vh' }}>
                        <div className="d-flex justify-content-between align-items-start mb-4">
                            <div>
                                <div className="badge bg-primary bg-opacity-10 text-primary-glow mb-2 font-mono">STEP {activeStep < 10 ? `0${activeStep}` : activeStep}</div>
                                <h4 className="fw-bold mb-1">{WORKFLOW_STEPS[activeStep - 1]?.title || 'Node Overview'}</h4>
                                <p className="text-white-50 small mb-0">{WORKFLOW_STEPS[activeStep - 1]?.description}</p>
                            </div>
                            <div className="d-flex flex-column align-items-end">
                                {activeExperiment.automationMode === 'automated' && (
                                    <>
                                        <span className={`badge ${automationPaused ? 'bg-warning text-dark' : 'bg-primary'} px-3 py-2 rounded-pill shadow-sm mb-2`}>
                                            <i className={`bi ${automationPaused ? 'bi-pause-circle-fill' : 'bi-cpu-fill'} me-1`}></i> 
                                            {automationPaused ? 'PAUSED' : 'AUTO'}
                                        </span>
                                        {automationPaused && (
                                            <button className="btn btn-xs btn-outline-warning" onClick={() => setAutomationPaused(false)}>RESUME</button>
                                        )}
                                        {reviewCountdown !== null && (
                                            <div className="text-info small fw-bold mt-1 font-mono">
                                                NEXT &gt; {reviewCountdown}s
                                                <button className="btn btn-link btn-xs text-info p-0 ms-2" onClick={() => handleCompleteStep()}>SKIP</button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                        <hr className="border-secondary opacity-10 mb-4" />
                        
                        {currentStepData?.blockers && (
                            <BlockerDisplay 
                                blockers={currentStepData.blockers} 
                                onResolve={handleResolveBlocker} 
                            />
                        )}

                        {renderStepContent()}
                    </div>
                    
                    {activeStep <= WORKFLOW_STEPS.length && (
                        <div className="card-footer d-flex flex-column flex-md-row justify-content-between align-items-center p-3 bg-dark bg-opacity-25 border-top border-secondary border-opacity-10 gap-3">
                            <button className="btn btn-sm btn-outline-secondary w-100 w-md-auto" onClick={() => setFineTuneModalOpen(true)}>
                                <i className="bi bi-sliders me-1"></i> Tuning
                            </button>
                            <button 
                                className={`btn btn-${hasCriticalBlocker ? 'outline-danger' : 'success'} px-4 shadow-sm w-100 w-md-auto`} 
                                onClick={() => handleCompleteStep()} 
                                disabled={isVerifying || !hasOutput || hasCriticalBlocker}
                            >
                                {isVerifying ? (
                                    <span><span className="spinner-border spinner-border-sm me-2"></span>{statusMessage || "VERIFYING..."}</span>
                                ) : (
                                    <span className="d-flex align-items-center">
                                        <i className={`bi ${hasCriticalBlocker ? 'bi-lock-fill' : (hasOutput ? 'bi-check-circle-fill' : 'bi-lock-fill')} me-2`}></i> 
                                        {hasCriticalBlocker ? 'BLOCKED' : (activeStep === 10 ? "FINISH PROJECT" : "VERIFY & CONTINUE")}
                                    </span>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </main>

            {fineTuneModalOpen && (
                <FineTuneModal stepId={activeStep} onClose={() => setFineTuneModalOpen(false)} />
            )}
        </div>
    );
};