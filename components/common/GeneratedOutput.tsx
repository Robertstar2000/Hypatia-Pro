import React, { useState, useEffect, useMemo } from 'react';
import { renderMarkdown } from '../../utils/markdownRenderer';
import { useExperiment, extractJson } from '../../services';
import { useToast } from '../../toast';
import { UniquenessMeter } from './UniquenessMeter';
import { DataAnalysisView } from './DataAnalysisView';

interface GeneratedOutputProps {
    stepId: number;
    onGenerate: (feedback?: string) => Promise<void>;
    isLoading: boolean;
    statusMessage?: string;
    streamingText?: string | null;
    onError?: (error: string) => void;
}

export const GeneratedOutput: React.FC<GeneratedOutputProps> = ({ 
    stepId, 
    onGenerate, 
    isLoading, 
    statusMessage,
    streamingText,
    onError
}) => {
    const { activeExperiment, updateExperiment } = useExperiment();
    const { addToast } = useToast();
    
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState('');
    const [showRegenInput, setShowRegenInput] = useState(false);
    const [regenFeedback, setRegenFeedback] = useState('');
    const [guidanceInput, setGuidanceInput] = useState('');

    const stepData = (activeExperiment.stepData && activeExperiment.stepData[stepId]) || {};
    const savedOutput = typeof stepData.output === 'string' ? stepData.output : '';
    const currentText = typeof streamingText === 'string' ? streamingText : savedOutput;

    useEffect(() => {
        setEditText(savedOutput);
    }, [savedOutput]);

    const handleSave = () => {
        updateExperiment({ 
            ...activeExperiment, 
            stepData: { 
                ...activeExperiment.stepData, 
                [stepId]: { ...stepData, output: editText } 
            } 
        });
        setIsEditing(false);
        addToast("Archival node updated.", "success");
    };

    const handleRegenerate = () => {
        if (isLoading) return;
        // For Step 3, we prioritize the dedicated guidance input
        const feedback = stepId === 3 ? guidanceInput : regenFeedback;
        onGenerate(feedback);
        if (stepId !== 3) {
            setShowRegenInput(false);
        }
        setRegenFeedback('');
    };

    const renderedHtml = useMemo(() => {
        if (!currentText) return '';
        try {
            return renderMarkdown(currentText, !isLoading);
        } catch (e) {
            console.error("Critical rendering error detected:", e);
            return `<div class="alert alert-danger">Rendering Error: Content Stream Interrupted.</div><pre class="text-white-50 small">${currentText.slice(0, 500)}...</pre>`;
        }
    }, [currentText, isLoading]);

    const renderJsonContent = (text: string) => {
        try {
            const clean = extractJson(text);
            if (!clean) throw new Error("No JSON found");
            const data = JSON.parse(clean);
            
            if (stepId === 1) {
                return (
                   <div className="animate-in">
                       <div className="mb-4" dangerouslySetInnerHTML={{ __html: renderMarkdown(data.research_question || '', true) }} />
                       {data.uniqueness_score !== undefined && (
                           <UniquenessMeter 
                                score={data.uniqueness_score} 
                                justification={data.justification || ''} 
                           />
                       )}
                   </div>
               );
            }

            if (stepId === 2) {
                return (
                    <div className="lit-review-output animate-in">
                        <h5 className="fw-bold text-primary-glow border-bottom border-secondary border-opacity-25 pb-2 mb-3">Synthesis of Findings</h5>
                        <div className="generated-text-container mb-4" dangerouslySetInnerHTML={{ __html: renderMarkdown(data.summary || '', true) }} />
                        {data.references && Array.isArray(data.references) && data.references.length > 0 && (
                            <section>
                                <h5 className="fw-bold text-info small text-uppercase ls-1 border-bottom border-secondary border-opacity-10 pb-2 mb-3">Grounding Links</h5>
                                <div className="list-group list-group-flush bg-transparent">
                                    {data.references.map((ref: any, i: number) => (
                                        <div key={i} className="list-group-item bg-transparent border-secondary border-opacity-10 px-0 py-2">
                                            <div className="fw-bold text-white small">{ref.title}</div>
                                            <div className="text-white-50" style={{fontSize: '0.75rem'}}>{ref.authors?.join(', ')} ({ref.year})</div>
                                            {ref.url && <a href={ref.url} target="_blank" rel="noopener noreferrer" className="small text-primary-glow">View Source &raquo;</a>}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                );
            }

            if (stepId === 7) return <DataAnalysisView analysisData={data} onError={onError} />;
            return <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />;
        } catch (e) {
            return (
                <div>
                     <div className="alert alert-warning small">
                        <i className="bi bi-exclamation-triangle me-2"></i>
                        Visual rendering failed due to malformed data. Raw output displayed below.
                    </div>
                    <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
                </div>
            );
        }
    };

    const isJsonStep = stepId === 1 || stepId === 2 || stepId === 7;

    return (
        <div className="generated-content-container">
            {isLoading && (
                <div className="archive-status-line mb-4 px-3 py-3 rounded d-flex flex-column gap-2 border border-primary border-opacity-25 bg-primary bg-opacity-5">
                    <div className="d-flex align-items-center justify-content-between">
                         <div className="d-flex align-items-center">
                              <div className="spinner-border spinner-border-sm text-primary-glow me-2" role="status"></div>
                              <span className="small text-uppercase fw-bold ls-1 text-primary-glow">
                                {statusMessage || "Processing..."}
                              </span>
                         </div>
                         <div className="spinner-grow spinner-grow-sm text-primary-glow opacity-50" role="status"></div>
                    </div>
                    <div className="progress bg-dark" style={{height: '2px'}}>
                         <div className="progress-bar progress-bar-striped progress-bar-animated bg-primary-glow w-100"></div>
                    </div>
                </div>
            )}

            {!currentText && !isLoading ? (
                <div className="text-center p-5 border border-secondary border-opacity-10 rounded-4 bg-dark bg-opacity-10 my-3">
                    <i className="bi bi-cpu mb-3 text-primary-glow opacity-50 d-block" style={{ fontSize: '2.5rem' }}></i>
                    <h5 className="fw-bold mb-2">Initialize Archival Node</h5>
                    <p className="text-white-50 small mb-4 mx-auto" style={{maxWidth: '350px'}}>
                        Synthesize discovery data from previous steps into a verifiable research node.
                    </p>
                    
                    {stepId === 3 && (
                        <div className="mb-4 text-start mx-auto p-3 rounded bg-black bg-opacity-20 border border-secondary border-opacity-25" style={{maxWidth: '450px'}}>
                            <label className="form-label small fw-bold text-warning mb-1">
                                <i className="bi bi-compass me-1"></i> Directional Guidance (Optional)
                            </label>
                            <div className="input-group">
                                <input
                                    type="text"
                                    className="form-control bg-dark border-secondary text-white small"
                                    placeholder="E.g., 'Focus on counter-intuitive mechanisms' or 'Prioritize low-cost methods'"
                                    value={guidanceInput}
                                    onChange={(e) => setGuidanceInput(e.target.value)}
                                    style={{fontSize: '0.9rem'}}
                                />
                            </div>
                            <div className="form-text text-white-50" style={{fontSize: '0.75rem'}}>
                                Use the <strong>Tuning</strong> menu below for precise parameter control.
                            </div>
                        </div>
                    )}

                    <button className="btn btn-primary px-5 py-2 rounded-pill shadow-sm" onClick={() => handleRegenerate()}>
                        <i className="bi bi-lightning-charge-fill me-2"></i> Generate {stepId === 3 ? 'Hypotheses' : 'Output'}
                    </button>
                </div>
            ) : null}

            {currentText && !isLoading && !isEditing && (
                <div className="animate-in">
                    {isJsonStep ? renderJsonContent(currentText) : <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />}
                    
                    <div className="mt-4 pt-3 border-top border-secondary border-opacity-10 d-flex justify-content-between align-items-center">
                        <div className="d-flex gap-2 align-items-center flex-wrap">
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => setIsEditing(true)}>
                                <i className="bi bi-pencil me-1"></i> Edit Content
                            </button>
                            
                            {stepId === 3 ? (
                                <div className="input-group input-group-sm ms-2" style={{width: '320px'}}>
                                    <span className="input-group-text bg-dark border-secondary text-white-50">
                                        <i className="bi bi-arrow-clockwise"></i>
                                    </span>
                                    <input
                                        type="text"
                                        className="form-control bg-dark border-secondary text-white"
                                        placeholder="Pivot (e.g. 'Make it more abstract')"
                                        value={guidanceInput}
                                        onChange={(e) => setGuidanceInput(e.target.value)}
                                    />
                                    <button className="btn btn-outline-warning" onClick={handleRegenerate} title="Regenerate with guidance">
                                        Go
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <button 
                                        className={`btn btn-sm ${showRegenInput ? 'btn-secondary' : 'btn-outline-secondary'}`} 
                                        onClick={() => setShowRegenInput(!showRegenInput)}
                                    >
                                        <i className="bi bi-arrow-clockwise me-1"></i> Regenerate
                                    </button>
                                    
                                    {showRegenInput && (
                                        <div className="d-flex gap-2 animate-in">
                                            <input 
                                                type="text" 
                                                className="form-control form-control-sm bg-dark text-white border-secondary" 
                                                placeholder="Instructions (e.g., 'Be more concise')"
                                                value={regenFeedback}
                                                onChange={(e) => setRegenFeedback(e.target.value)}
                                                autoFocus
                                            />
                                            <button className="btn btn-sm btn-warning" onClick={handleRegenerate}>Go</button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="text-white-50 small fst-italic">
                            AI-Generated • Verify before proceeding
                        </div>
                    </div>
                </div>
            )}

            {isEditing && (
                <div className="editing-interface animate-in">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                        <h6 className="fw-bold text-primary-glow">Editing Archival Node</h6>
                        <span className="badge bg-secondary">Manual Override</span>
                    </div>
                    <textarea 
                        className="form-control mb-3 font-monospace small bg-dark text-white border-secondary" 
                        rows={15} 
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                    ></textarea>
                    <div className="d-flex justify-content-end gap-2">
                        <button className="btn btn-outline-secondary" onClick={() => setIsEditing(false)}>Cancel</button>
                        <button className="btn btn-success" onClick={handleSave}><i className="bi bi-save me-1"></i> Save Changes</button>
                    </div>
                </div>
            )}
        </div>
    );
};