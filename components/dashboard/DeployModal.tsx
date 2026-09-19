
import React, { useState, useEffect, useRef } from 'react';
import { renderMarkdown } from '../../utils/markdownRenderer';
import { Experiment } from '../../config';
import { useToast } from '../../toast';
import { getStepContext, getPromptForStep, parseGeminiError, callGeminiWithRetry, safeGetText } from '../../services';

export const DeployModal = ({ experiment, onClose, onUpdateExperiment, onExportExperiment, isAuthenticated }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [generatedContent, setGeneratedContent] = useState('');
    const [activeVirtualStep, setActiveVirtualStep] = useState<number | null>(null);
    const { addToast } = useToast();

    // Mount safety
    const isMounted = useRef(true);
    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    const handleAction = async (step: number, forceRegenerate: boolean = false) => {
        if (isLoading) return;
        setActiveVirtualStep(step);

        if (!forceRegenerate && experiment.stepData[step]?.output) {
            setGeneratedContent(experiment.stepData[step].output);
            addToast("Loaded saved content.", "info");
            return;
        }

        if (!isAuthenticated) {
            addToast("Gemini AI is not available. Please verify credentials.", 'danger');
            return;
        }
        
        if (forceRegenerate && !window.confirm("This will replace the current content with a new AI generation. Any unsaved edits will be lost. Are you sure?")) {
            return;
        }

        setIsLoading(true);
        setGeneratedContent('');

        addToast("Connecting to archive network...", 'info');
        
        try {
            const context = await getStepContext(experiment, step);
            const { basePrompt, config } = getPromptForStep(step, '', context, {});
            const response = await callGeminiWithRetry('gemini-3-flash-preview', { contents: basePrompt, config });
            const newContent = safeGetText(response);

            if (isMounted.current) {
                setGeneratedContent(newContent);
                const updatedStepData = {
                    ...experiment.stepData,
                    [step]: { ...(experiment.stepData[step] || {}), output: newContent }
                };
                await onUpdateExperiment({ ...experiment, stepData: updatedStepData });
                addToast("Content generated and saved.", "success");
            }
        } catch (error) {
            if (isMounted.current) {
                addToast(parseGeminiError(error, "Failed to generate content."), 'danger');
            }
        } finally {
            if (isMounted.current) {
                setIsLoading(false);
            }
        }
    };

    const handleSaveEdits = async () => {
        if (!activeVirtualStep) return;
        const updatedStepData = {
            ...experiment.stepData,
            [activeVirtualStep]: { ...(experiment.stepData[activeVirtualStep] || {}), output: generatedContent }
        };
        await onUpdateExperiment({ ...experiment, stepData: updatedStepData });
        addToast("Edits saved successfully!", "success");
    };

    const generateShareableSummary = () => {
        const publicationText = experiment.stepData[10]?.output || 'No publication draft found.';
        // Use renderMarkdown instead of marked() to avoid import crashes and ensure consistency
        const renderedBody = renderMarkdown(publicationText);
        
        const htmlContent = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${experiment.title}</title>
                <style> body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 20px auto; padding: 25px; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); } h1, h2, h3 { color: #000; } hr { border: 0; border-top: 1px solid #eee; margin: 20px 0; } </style>
            </head>
            <body>
                <h1>${experiment.title}</h1>
                <p><strong>Field:</strong> ${experiment.field}</p>
                <p><em>${experiment.description}</em></p>
                <hr>
                <div>${renderedBody}</div>
            </body>
            </html>
        `;
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${experiment.title.replace(/\s+/g, '_')}_summary.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addToast("Shareable summary downloaded.", 'success');
    };

    const renderContent = () => {
        if (isLoading) {
            return <div className="text-center p-4"><div className="spinner-border"></div><p className="mt-2">AI is working...</p></div>;
        }
        if (generatedContent) {
            return (
                <div>
                    <textarea 
                        className="form-control" 
                        rows={10} 
                        value={generatedContent} 
                        onChange={e => setGeneratedContent(e.target.value)}
                    ></textarea>
                     <div className="mt-2 d-flex justify-content-start">
                        <button className="btn btn-sm btn-success me-2" onClick={handleSaveEdits}>
                            <i className="bi bi-save me-1"></i> Save Edits
                        </button>
                        <button className="btn btn-sm btn-outline-secondary me-2" onClick={() => { navigator.clipboard.writeText(generatedContent); addToast('Copied to clipboard!', 'success'); }}>
                            <i className="bi bi-clipboard me-1"></i> Copy
                        </button>
                        <button className="btn btn-sm btn-outline-warning" onClick={() => handleAction(activeVirtualStep!, true)}>
                            <i className="bi bi-arrow-clockwise me-1"></i> Regenerate
                        </button>
                    </div>
                </div>
            );
        }
        return null;
    };

    const renderManualMode = () => (
        <>
            <h5 className="modal-title">Deploy Your Research</h5>
            <p className="text-white-50 small">This project used the Manual Control workflow, ideal for rigorous scientific work.</p>
            <div className="d-grid gap-2 mt-3">
                <button className="btn btn-outline-primary" onClick={() => handleAction(11)}>
                    {experiment.stepData[11]?.output ? 'View/Edit' : 'Generate'} Submission Checklist
                </button>
                <button className="btn btn-outline-secondary" onClick={() => onExportExperiment(experiment)}>Export for Collaboration</button>
            </div>
        </>
    );

    const renderAutomatedMode = () => (
        <>
            <h5 className="modal-title">Share Your Exploration</h5>
            <p className="text-white-50 small">This project used the Automated Generation workflow, great for educational use.</p>
            <div className="d-grid gap-2 mt-3">
                <button className="btn btn-outline-primary" onClick={() => handleAction(12)}>
                    {experiment.stepData[12]?.output ? 'View/Edit' : 'Generate'} Presentation Outline
                </button>
                <button className="btn btn-outline-secondary" onClick={generateShareableSummary}>Download Shareable Summary (HTML)</button>
            </div>
        </>
    );

    return (
         <div className="modal" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                    <div className="modal-header">
                        {experiment.automationMode === 'manual' ? renderManualMode() : renderAutomatedMode()}
                        <button type="button" className="btn-close" onClick={onClose}></button>
                    </div>
                    <div className="modal-body">
                        {renderContent()}
                    </div>
                </div>
            </div>
        </div>
    );
};
