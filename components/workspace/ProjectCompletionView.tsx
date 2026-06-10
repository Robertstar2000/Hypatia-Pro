
import React, { useState, useEffect, useRef } from 'react';
import { useExperiment } from '../../context/ExperimentContext';
import { WORKFLOW_STEPS } from '../../config';
import { renderMarkdown } from '../../utils/markdownRenderer';
import { FinalPublicationView } from '../steps/PublicationExporter';
import { useToast } from '../../toast';
import JSZip from 'jszip';
import { getStepContext, getPromptForStep, callGeminiWithRetry, parseGeminiError, safeGetText } from '../../services';

export const ProjectCompletionView = () => {
    const { activeExperiment, updateExperiment, isAuthenticated } = useExperiment();
    const { addToast } = useToast();
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Mount safety
    const isMounted = useRef(true);
    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);
    
    if (!activeExperiment) {
        return <div>Loading...</div>;
    }
    
    const { title: experimentTitle, stepData } = activeExperiment;
    const publicationText = stepData[10]?.output;
    const experimentalData = stepData[7]?.input;
    const analysisJson = stepData[7]?.output;
    const explanationText = stepData[13]?.output;
    
    let analysisData;
    try {
        analysisData = analysisJson ? JSON.parse(analysisJson.replace(/```json/g, '').replace(/```/g, '')) : null;
    } catch (e) {
        analysisData = null;
    }
    const charts = analysisData?.charts || [];

    const handleGenerateExplanation = async () => {
        if (!isAuthenticated || !publicationText || isGenerating) return;
        
        setIsGenerating(true);
        try {
            const context = await getStepContext(activeExperiment, 13);
            const { basePrompt, config } = getPromptForStep(13, '', context, {});
            const response = await callGeminiWithRetry('gemini-3-flash-preview', { 
                contents: basePrompt, 
                config 
            });
            const newContent = safeGetText(response);

            if (isMounted.current) {
                const updatedStepData = {
                    ...activeExperiment.stepData,
                    13: { ...(activeExperiment.stepData[13] || {}), output: newContent }
                };
                await updateExperiment({ ...activeExperiment, stepData: updatedStepData });
                addToast("Explanation generated and saved.", "success");
            }
        } catch (error) {
            if (isMounted.current) {
                addToast(parseGeminiError(error, "Failed to generate explanation."), 'danger');
            }
        } finally {
            if (isMounted.current) {
                setIsGenerating(false);
            }
        }
    };

    const handleDownloadPaper = (format: 'md' | 'txt' | 'doc' | 'pdf') => {
        if (!publicationText) {
            addToast("No publication text to download.", "warning");
            return;
        }

        const tempContainer = document.createElement('div');
        tempContainer.style.visibility = 'hidden';
        tempContainer.style.position = 'absolute';
        document.body.appendChild(tempContainer);

        const htmlContent = renderMarkdown(publicationText);
        tempContainer.innerHTML = htmlContent;

        if (format === 'pdf') {
            addToast("Preparing a print-friendly view...", "info");
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                addToast("Could not open a new window. Please check your browser's pop-up blocker.", 'warning');
                document.body.removeChild(tempContainer);
                return;
            }
            printWindow.document.write(`
                <!DOCTYPE html><html><head><title>Print - ${experimentTitle}</title>
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 20px auto; padding: 20px; } 
                    img { max-width: 100%; height: auto; }
                    .katex-display { margin: 1em 0; overflow-x: auto; overflow-y: hidden; }
                </style>
                </head><body>${htmlContent}
                <script>setTimeout(() => { window.print(); window.close(); }, 800);</script>
                </body></html>`);
            printWindow.document.close();
            document.body.removeChild(tempContainer);
            return;
        }

        let blob;
        let filename = `${experimentTitle.replace(/ /g, '_')}_publication`;
        if (format === 'doc') {
             const docContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
                <head><meta charset='utf-8'><title>${experimentTitle}</title>
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
                </head>
                <body>${htmlContent}</body></html>`;
             blob = new Blob(['\ufeff', docContent], { type: 'application/msword' });
             filename += '.doc';
        } else {
            const content = format === 'md' ? publicationText : tempContainer.innerText;
            blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            filename += `.${format}`;
        }
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(tempContainer);
        addToast(`Paper downloaded as .${format}`, 'success');
    };
    
    const handleDownloadAll = async () => {
        addToast("Preparing zip file...", 'info');
        try {
            const zip = new JSZip();
            const projectFolder = zip.folder(experimentTitle.replace(/\s+/g, '_') || 'project');

            if (projectFolder) {
                if (publicationText) projectFolder.file('publication.md', publicationText);
                const rawOutputsFolder = projectFolder.folder('raw_outputs');
                if (rawOutputsFolder) {
                    WORKFLOW_STEPS.forEach(step => {
                        const output = stepData[step.id]?.output;
                        if (output) rawOutputsFolder.file(`step_${step.id}.md`, output);
                    });
                }

                if (experimentalData) projectFolder.file('experimental_data.csv', experimentalData);

                if (charts.length > 0) {
                    const vizFolder = projectFolder.folder('visualizations');
                    if (vizFolder) {
                        charts.forEach((chart, i) => {
                            if (chart.imageData) vizFolder.file(`chart_${i + 1}.png`, chart.imageData, { base64: true });
                        });
                    }
                }
            }
            
            const content = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(content);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${experimentTitle.replace(/\s+/g, '_') || 'project'}_archive.zip`;
            link.click();
            URL.revokeObjectURL(url);
            addToast('Project archive downloaded!', 'success');
        } catch (error) {
            console.error("Zip generation error:", error);
            addToast(`Zip failed: ${error instanceof Error ? error.message : "Unknown error"}`, 'danger');
        }
    };

    return (
        <div className="p-3 completion-view-wrapper">
            <div className="text-center mb-4">
                <i className="bi bi-award-fill" style={{fontSize: '3rem', color: 'var(--primary-glow)'}}></i>
                <h3 className="mt-3">Research Project Complete</h3>
                <p className="text-white-50">Review and download your assets below.</p>
            </div>
            
            <div className="card mb-4">
                <div className="card-body d-flex justify-content-center align-items-center gap-3 flex-wrap p-3">
                    <button className="btn btn-primary" onClick={handleDownloadAll}><i className="bi bi-file-zip-fill me-2"></i> Download All (.zip)</button>
                    <div className="btn-group">
                        <button type="button" className="btn btn-secondary dropdown-toggle" data-bs-toggle="dropdown" disabled={!publicationText}><i className="bi bi-download me-2"></i> Download Paper</button>
                        <ul className="dropdown-menu dropdown-menu-end">
                            <li><a className="dropdown-item" href="#" onClick={(e) => { e.preventDefault(); handleDownloadPaper('md'); }}>Markdown (.md)</a></li>
                            <li><a className="dropdown-item" href="#" onClick={(e) => { e.preventDefault(); handleDownloadPaper('txt'); }}>Plain Text (.txt)</a></li>
                            <li><a className="dropdown-item" href="#" onClick={(e) => { e.preventDefault(); handleDownloadPaper('doc'); }}>Word Document (.doc)</a></li>
                            <li><a className="dropdown-item" href="#" onClick={(e) => { e.preventDefault(); handleDownloadPaper('pdf'); }}>PDF (Print)</a></li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="text-center mb-4 opacity-75">
                <div className="alert alert-dark border-white border-opacity-10 py-2">
                    <p className="mb-0 small text-white-50">
                        <strong>Version Notice:</strong> This is the Ideation Version of Project Hypatia. 
                        LLM background summarization is active to manage token windows for large projects.
                    </p>
                </div>
            </div>

            <ul className="nav nav-tabs" id="completionTabs" role="tablist">
                <li className="nav-item" role="presentation"><button className="nav-link active" id="pub-tab" data-bs-toggle="tab" data-bs-target="#pub-pane">Publication</button></li>
                <li className="nav-item" role="presentation"><button className="nav-link" id="explain-tab" data-bs-toggle="tab" data-bs-target="#explain-pane">Explain</button></li>
                <li className="nav-item" role="presentation"><button className="nav-link" id="viz-tab" data-bs-toggle="tab" data-bs-target="#viz-pane">Visualizations</button></li>
            </ul>
            
            <div className="tab-content card" id="completionTabsContent">
                <div className="tab-pane fade show active" id="pub-pane" role="tabpanel">
                     {publicationText ? <div className="p-3"><FinalPublicationView publicationText={publicationText} showRegenerate={false} onRegenerate={() => {}} /></div> : <div className="alert alert-warning m-3">Not generated yet.</div>}
                </div>
                <div className="tab-pane fade" id="explain-pane" role="tabpanel">
                    <div className="p-3">
                        {isGenerating ? (
                            <div className="text-center p-5"><div className="spinner-border"></div></div>
                        ) : explanationText ? (
                            <div className="generated-text-container" dangerouslySetInnerHTML={{ __html: renderMarkdown(explanationText) }}></div>
                        ) : (
                            <div className="text-center p-5">
                                <h5>Explain This Paper</h5>
                                <button className="btn btn-primary" onClick={handleGenerateExplanation} disabled={!publicationText}>Generate Explanation</button>
                            </div>
                        )}
                    </div>
                </div>
                <div className="tab-pane fade p-3" id="viz-pane" role="tabpanel">
                    {charts.length > 0 ? (
                        <div className="row">
                            {charts.map((chart, index) => (
                                <div className="col-lg-6 mb-3" key={index}>
                                    <div className="card h-100">
                                        <div className="card-header fw-bold">{chart.title}</div>
                                        <div className="card-body text-center p-2">
                                             <img src={`data:image/png;base64,${chart.imageData}`} alt={chart.title} style={{ maxWidth: '100%', maxHeight: '400px' }} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : <div className="alert alert-info">No visualizations.</div>}
                </div>
            </div>
        </div>
    );
};
