
import React, { useState, useEffect, useRef } from 'react';
import { useExperiment, generateLabImage } from '../../services';
import { WORKFLOW_STEPS } from '../../config';
import { useToast } from '../../toast';
import { renderMarkdown } from '../../utils/markdownRenderer';
import JSZip from 'jszip';
import { AgentLogEntry } from '../../config';

export const ProjectDocumentation = () => {
    const { activeExperiment, updateExperiment, experiments, selectExperiment } = useExperiment();
    const { addToast } = useToast();
    const [activeStepId, setActiveStepId] = useState(1);
    const [activeTab, setActiveTab] = useState<'output' | 'input' | 'logs' | 'visuals' | 'all'>('output');
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [selectedArtifact, setSelectedArtifact] = useState<any>(null);

    if (!activeExperiment) {
        return (
            <div className="container py-5">
                <h2 className="text-center mb-4">Select a project to view its artifacts</h2>
                <div className="row g-4">
                    {experiments.map(exp => (
                        <div key={exp.id} className="col-md-4">
                            <div className="card bg-dark border-secondary h-100 p-3">
                                <h5>{exp.title}</h5>
                                <p className="text-white-50 small">{exp.description}</p>
                                <button className="btn btn-outline-primary mt-auto" onClick={() => selectExperiment(exp.id)}>
                                    View Artifacts
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const stepData = activeExperiment.stepData[activeStepId] || {};
    const stepInfo = WORKFLOW_STEPS.find(s => s.id === activeStepId);

    const handleGenerateImage = async () => {
        if (isGeneratingImage) return;
        setIsGeneratingImage(true);
        addToast("Generating lab visualization with Gemini 3...", "info");

        try {
            // Construct a prompt based on the step output/summary
            const context = stepData.output || stepData.summary || activeExperiment.description;
            const prompt = `Generate a high-fidelity scientific visualization or lab setup diagram representing the following concept from a ${activeExperiment.field} research project:\n\n${context.substring(0, 500)}`;
            
            const base64Image = await generateLabImage(prompt);
            
            if (base64Image) {
                const newImage = {
                    id: `img_${Date.now()}`,
                    prompt: prompt,
                    base64Data: base64Image,
                    timestamp: new Date().toISOString()
                };
                
                const updatedStepData = {
                    ...activeExperiment.stepData,
                    [activeStepId]: {
                        ...stepData,
                        images: [...(stepData.images || []), newImage]
                    }
                };
                
                await updateExperiment({ ...activeExperiment, stepData: updatedStepData });
                addToast("Visualization generated and saved to artifacts.", "success");
            } else {
                addToast("Failed to generate image.", "warning");
            }
        } catch (e) {
            console.error(e);
            addToast("Error generating visualization.", "danger");
        } finally {
            setIsGeneratingImage(false);
        }
    };

    const downloadArtifact = (content: string, filename: string, type: string = 'text/plain') => {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const downloadImage = (base64: string, filename: string) => {
        const link = document.createElement("a");
        link.href = `data:image/png;base64,${base64}`;
        link.download = filename;
        link.click();
    };

    const handleZipDownload = async () => {
        addToast("Bundling project artifacts...", "info");
        const zip = new JSZip();
        const root = zip.folder(activeExperiment.title.replace(/[^a-z0-9]/gi, '_').substring(0, 30));

        if (!root) return;

        // Add Lab Notebook
        if (activeExperiment.labNotebook) {
            root.file("Lab_Notebook.md", activeExperiment.labNotebook);
        }

        // Iterate through steps
        WORKFLOW_STEPS.forEach(step => {
            const sData = activeExperiment.stepData[step.id];
            if (!sData) return;

            const stepFolder = root.folder(`Step_${step.id}_${step.title.replace(/[^a-z0-9]/gi, '_')}`);
            if (!stepFolder) return;

            if (sData.output) stepFolder.file("Output_Report.md", sData.output);
            if (sData.input) stepFolder.file("Input_Config.txt", sData.input);
            if (sData.summary) stepFolder.file("Summary.txt", sData.summary);
            
            if (sData.agentLogs && sData.agentLogs.length > 0) {
                const logText = sData.agentLogs.map(l => `[${l.timestamp}] ${l.agent}: ${l.message}`).join('\n');
                stepFolder.file("Agent_Logs.txt", logText);
            }

            if (sData.images && sData.images.length > 0) {
                const imgFolder = stepFolder.folder("Visualizations");
                sData.images.forEach((img, idx) => {
                    imgFolder?.file(`Viz_${idx + 1}.png`, img.base64Data, { base64: true });
                });
            }
        });

        const content = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${activeExperiment.id}_Full_Artifacts.zip`;
        a.click();
        URL.revokeObjectURL(url);
        addToast("Download started.", "success");
    };

    const handlePrintPDF = () => {
        window.print();
    };

    return (
        <div className="documentation-page-container container-fluid py-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h3 className="fw-bold mb-1"><i className="bi bi-folder2-open me-2 text-primary-glow"></i>Project Artifacts Hub</h3>
                    <p className="text-white-50 mb-0">{activeExperiment.title}</p>
                </div>
                <div className="d-flex gap-2">
                    <button className="btn btn-outline-secondary" onClick={handlePrintPDF}>
                        <i className="bi bi-printer me-2"></i> Print / PDF
                    </button>
                    <button className="btn btn-primary" onClick={handleZipDownload}>
                        <i className="bi bi-file-earmark-zip me-2"></i> Download All (.zip)
                    </button>
                </div>
            </div>

            <div className="row g-4">
                {/* Sidebar */}
                <div className="col-md-3 col-lg-2 d-print-none">
                    <div className="list-group sticky-top" style={{ top: '100px' }}>
                        {WORKFLOW_STEPS.map(step => {
                            const hasData = activeExperiment.stepData[step.id]?.output;
                            return (
                                <button
                                    key={step.id}
                                    className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${activeStepId === step.id ? 'active' : ''}`}
                                    onClick={() => setActiveStepId(step.id)}
                                >
                                    <div>
                                        <span className="fw-bold me-2">{step.id}.</span>
                                        <span className="small">{step.title}</span>
                                    </div>
                                    {hasData && <i className="bi bi-check-circle-fill text-success small"></i>}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Main Content */}
                <div className="col-md-9 col-lg-10">
                    <div className="card shadow-sm border-secondary border-opacity-25 bg-black bg-opacity-20" style={{ minHeight: '70vh' }}>
                        <div className="card-header bg-dark bg-opacity-50 p-3">
                            <div className="d-flex justify-content-between align-items-center">
                                <h5 className="mb-0 fw-bold">{stepInfo?.title}</h5>
                                <div className="nav nav-pills card-header-pills d-print-none">
                                    <button className={`nav-link btn-sm ${activeTab === 'output' ? 'active' : ''}`} onClick={() => setActiveTab('output')}>
                                        Output Report
                                    </button>
                                    <button className={`nav-link btn-sm ${activeTab === 'input' ? 'active' : ''}`} onClick={() => setActiveTab('input')}>
                                        Input & Settings
                                    </button>
                                    <button className={`nav-link btn-sm ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
                                        Agent Logs {stepData.agentLogs?.length ? `(${stepData.agentLogs.length})` : ''}
                                    </button>
                                    <button className={`nav-link btn-sm ${activeTab === 'visuals' ? 'active' : ''}`} onClick={() => setActiveTab('visuals')}>
                                        Visualizations {stepData.images?.length ? `(${stepData.images.length})` : ''}
                                    </button>
                                    <button className={`nav-link btn-sm ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
                                        All Artifacts
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="card-body p-4">
                            {/* OUTPUT TAB */}
                            {activeTab === 'output' && (
                                <div className="animate-in">
                                    {stepData.output ? (
                                        <>
                                            <div className="d-flex justify-content-end mb-3 d-print-none">
                                                <button className="btn btn-sm btn-outline-secondary" onClick={() => downloadArtifact(stepData.output!, `Step_${activeStepId}_Output.md`)}>
                                                    <i className="bi bi-download me-1"></i> Download Markdown
                                                </button>
                                            </div>
                                            <div className="generated-text-container print-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(stepData.output) }} />
                                        </>
                                    ) : (
                                        <div className="text-center text-white-50 py-5">No output generated for this step yet.</div>
                                    )}
                                </div>
                            )}

                            {/* INPUT TAB */}
                            {activeTab === 'input' && (
                                <div className="animate-in">
                                    <div className="mb-4">
                                        <h6 className="fw-bold text-primary-glow">User Input</h6>
                                        <pre className="bg-dark p-3 rounded border border-secondary border-opacity-25">{stepData.input || "No explicit user input recorded."}</pre>
                                    </div>
                                    {activeExperiment.fineTuneSettings?.[activeStepId] && (
                                        <div>
                                            <h6 className="fw-bold text-info">AI Configuration</h6>
                                            <pre className="bg-dark p-3 rounded border border-secondary border-opacity-25">
                                                {JSON.stringify(activeExperiment.fineTuneSettings[activeStepId], null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* LOGS TAB */}
                            {activeTab === 'logs' && (
                                <div className="animate-in">
                                    {stepData.agentLogs && stepData.agentLogs.length > 0 ? (
                                        <>
                                             <div className="d-flex justify-content-end mb-3 d-print-none">
                                                <button className="btn btn-sm btn-outline-secondary" onClick={() => downloadArtifact(JSON.stringify(stepData.agentLogs, null, 2), `Step_${activeStepId}_Logs.json`)}>
                                                    <i className="bi bi-download me-1"></i> Download Logs
                                                </button>
                                            </div>
                                            <div className="log-viewer bg-black p-3 rounded border border-secondary border-opacity-25" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                                                {stepData.agentLogs.map((log, idx) => (
                                                    <div key={idx} className="mb-2 font-monospace small border-bottom border-white border-opacity-10 pb-1">
                                                        <span className="text-white-50 me-2">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                                                        <span className="text-info fw-bold me-2">{log.agent}:</span>
                                                        <span className="text-light">{log.message}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center text-white-50 py-5">No agent logs recorded for this step.</div>
                                    )}
                                </div>
                            )}

                            {/* VISUALS TAB */}
                            {activeTab === 'visuals' && (
                                <div className="animate-in">
                                    <div className="row g-4 mb-4">
                                        {stepData.images?.map((img) => (
                                            <div key={img.id} className="col-md-6">
                                                <div className="card bg-dark border-secondary border-opacity-25">
                                                    <img src={`data:image/png;base64,${img.base64Data}`} className="card-img-top" alt="Visualization" />
                                                    <div className="card-body">
                                                        <p className="card-text small text-white-50 text-truncate" title={img.prompt}>{img.prompt}</p>
                                                        <button className="btn btn-sm btn-outline-light w-100" onClick={() => downloadImage(img.base64Data, `Viz_${activeStepId}_${img.id}.png`)}>
                                                            <i className="bi bi-download me-1"></i> Download PNG
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    <div className="text-center border-top border-secondary border-opacity-25 pt-4 mt-4 d-print-none">
                                        <p className="text-white-50 mb-3">Generate a new high-fidelity visualization for this step using Gemini 3.</p>
                                        <button className="btn btn-primary" onClick={handleGenerateImage} disabled={isGeneratingImage || !stepData.output}>
                                            {isGeneratingImage ? (
                                                <><span className="spinner-border spinner-border-sm me-2"></span>Generating...</>
                                            ) : (
                                                <><i className="bi bi-palette me-2"></i> Generate Visualization</>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ALL ARTIFACTS TAB */}
                            {activeTab === 'all' && (
                                <div className="animate-in">
                                    <div className="row g-4">
                                        {WORKFLOW_STEPS.flatMap(step => {
                                            const sData = activeExperiment.stepData[step.id];
                                            if (!sData) return [];
                                            const artifacts = [];
                                            if (sData.output) artifacts.push({ type: 'document', title: `${step.title} Output`, content: sData.output, id: `doc_${step.id}`, stepId: step.id });
                                            if (sData.images) sData.images.forEach(img => artifacts.push({ type: 'image', title: `Viz ${step.id}`, data: img.base64Data, id: img.id, stepId: step.id }));
                                            return artifacts;
                                        }).map(artifact => (
                                            <div key={artifact.id} className="col-md-3">
                                                <div className="card bg-dark border-secondary h-100 p-3">
                                                    <div className="text-truncate mb-2 fw-bold">{artifact.title}</div>
                                                    <div className="text-white-50 small mb-3">Type: {artifact.type}</div>
                                                    <button className="btn btn-sm btn-outline-primary mt-auto" onClick={() => setSelectedArtifact(artifact)}>View & Download</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Artifact Modal */}
            {selectedArtifact && (
                <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}>
                    <div className="modal-dialog modal-lg modal-dialog-centered">
                        <div className="modal-content bg-dark text-white">
                            <div className="modal-header">
                                <h5 className="modal-title">{selectedArtifact.title}</h5>
                                <button className="btn-close btn-close-white" onClick={() => setSelectedArtifact(null)}></button>
                            </div>
                            <div className="modal-body">
                                {selectedArtifact.type === 'document' ? (
                                    <div dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedArtifact.content) }} />
                                ) : (
                                    <img src={`data:image/png;base64,${selectedArtifact.data}`} className="img-fluid" alt="Artifact" />
                                )}
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary" onClick={() => setSelectedArtifact(null)}>Close</button>
                                <button className="btn btn-primary" onClick={() => {
                                    if (selectedArtifact.type === 'document') downloadArtifact(selectedArtifact.content, `${selectedArtifact.title}.md`);
                                    else downloadImage(selectedArtifact.data, `${selectedArtifact.title}.png`);
                                }}>
                                    <i className="bi bi-download me-1"></i> Download
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            <style>{`
                @media print {
                    .d-print-none { display: none !important; }
                    .print-content { font-size: 12pt; color: black; }
                    body, .card { background: white !important; color: black !important; }
                    .generated-text-container { color: black !important; }
                }
            `}</style>
        </div>
    );
};
