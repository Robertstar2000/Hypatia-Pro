import React, { useState, useMemo, useRef } from 'react';
import { useToast } from '../../toast';
import { useExperiment, getKeyStatus, callGeminiWithRetry, safeGetText } from '../../services';
import { ResearchSummary } from './ResearchSummary';
import { SCIENTIFIC_FIELDS } from '../../config';

export const LandingPage = ({ setView }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [field, setField] = useState<string>('');
    const [isAnalyzingFile, setIsAnalyzingFile] = useState(false);
    const { addToast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // API connection check
    const keyStatus = getKeyStatus();

    const { isAuthenticated, createNewExperiment, experiments, selectExperiment, deleteExperiment } = useExperiment();

    // Memoize filtering to prevent re-calculation on every render
    const savedProjects = useMemo(() => {
        return Array.isArray(experiments) ? experiments.filter(e => e.status === 'archived') : [];
    }, [experiments]);

    const handleStart = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!title.trim()) {
            addToast("Please enter a project title.", "warning");
            return;
        }
        if (!description.trim()) {
            addToast("Please describe your research idea.", "warning");
            return;
        }
        if (!field) {
            addToast("Please select a scientific field.", "warning");
            return;
        }
        
        createNewExperiment(title, description, field);
    };

    const handleAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!title) {
            addToast("Please enter a Project Title first so the AI knows what to look for.", "warning");
            e.target.value = ''; // Reset
            return;
        }

        if (!isAuthenticated) {
            addToast("API Key required to analyze attachments.", "warning");
            return;
        }

        setIsAnalyzingFile(true);
        const reader = new FileReader();

        reader.onload = async (event) => {
            try {
                const textContent = event.target?.result as string;
                if (!textContent) throw new Error("File is empty");

                addToast("Analyzing document context...", "info");

                const prompt = `
                    ACT AS: Senior Research Assistant.
                    TASK: Analyze the provided document text and extract key facts, researcher names, references, and methodological details that are specifically relevant to the research topic: "${title}".
                    
                    DOCUMENT CONTENT:
                    ${textContent.substring(0, 30000)}... (truncated if too long)

                    OUTPUT REQUIREMENT:
                    Provide a concise, bulleted summary of these extracted facts to append to a project description. Do not include conversational filler.
                `;

                const response = await callGeminiWithRetry('gemini-3-flash-preview', { contents: prompt });
                
                setDescription(prev => {
                    const separator = prev ? "\n\n--- EXTRACTED CONTEXT FROM ATTACHMENT ---\n" : "--- EXTRACTED CONTEXT FROM ATTACHMENT ---\n";
                    return prev + separator + safeGetText(response);
                });

                addToast("Context extracted and appended to description.", "success");

            } catch (error) {
                console.error(error);
                addToast("Failed to analyze attachment. Ensure it is a text-readable file.", "danger");
            } finally {
                setIsAnalyzingFile(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };

        reader.onerror = () => {
            addToast("Error reading file.", "danger");
            setIsAnalyzingFile(false);
        };

        // Attempt to read as text (good for .txt, .md, .csv, code files)
        reader.readAsText(file);
    };

    return (
        <div className="landing-page-wrapper">
            <section className="py-5">
                <div className="container text-center">
                    <h1 className="display-3 landing-title mb-3 fw-bold">Project Hypatia <span className="text-primary-glow">Pro</span></h1>
                    <p className="lead text-white-50 mb-4 mx-auto" style={{maxWidth: '800px'}}>
                        Your AI-powered digital lab partner. Navigate the scientific method with precision, from initial ideation to a publication-ready manuscript.
                    </p>
                    
                    <div className="d-flex flex-wrap justify-content-center gap-3 mb-5 mx-auto" style={{maxWidth: '900px'}}>
                        <div className="d-flex align-items-center px-4 py-3 rounded-pill bg-black bg-opacity-20 border border-secondary border-opacity-25 shadow-sm">
                            <i className="bi bi-flask fs-5 text-success me-3"></i>
                            <div className="text-start lh-1">
                                <div className="fw-bold text-white small mb-1">Researcher-Led Experiments</div>
                                <div className="text-white-50" style={{fontSize: '0.75rem'}}>Perform & log physical lab work</div>
                            </div>
                        </div>
                        <div className="d-flex align-items-center px-4 py-3 rounded-pill bg-black bg-opacity-20 border border-secondary border-opacity-25 shadow-sm">
                            <i className="bi bi-cpu-fill fs-5 text-primary-glow me-3"></i>
                            <div className="text-start lh-1">
                                <div className="fw-bold text-white small mb-1">AI Experimental Simulation</div>
                                <div className="text-white-50" style={{fontSize: '0.75rem'}}>Run autonomous theoretical models</div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="alert alert-dark border-primary border-opacity-25 bg-primary bg-opacity-5 mx-auto mb-5 p-4 rounded-4" style={{maxWidth: '850px'}}>
                        <p className="mb-0 text-light fw-medium">
                            Designed for professional laboratory use. Every LLM usage is verified, and the experimental capabilities are significantly expanded.
                        </p>
                    </div>
                     
                    <div className="card text-start mx-auto shadow-lg" style={{maxWidth: '800px'}}>
                         <div className="card-body p-4">
                             <div className="d-flex justify-content-between align-items-center mb-3">
                                 <h5 className="mb-0 fw-bold">Initialize New Pro Project</h5>
                                 {keyStatus.type === 'none' && (
                                     <span className="badge bg-danger">API Disconnected</span>
                                 )}
                             </div>

                             {keyStatus.type === 'none' && (
                                <div className="alert alert-danger small mb-3">
                                    <i className="bi bi-exclamation-triangle-fill me-2"></i> 
                                    System Error: No Environment API Key Detected. Please check your configuration.
                                </div>
                             )}

                             <form onSubmit={handleStart}>
                                <div className="mb-3">
                                    <label className="form-label fw-bold small text-uppercase text-white-50">1. Project Title</label>
                                    <input 
                                        type="text" 
                                        className="form-control" 
                                        placeholder="E.g., The Impact of Sleep on Cognitive Load" 
                                        value={title} 
                                        onChange={e => setTitle(e.target.value)} 
                                        required 
                                    />
                                </div>
                                
                                <div className="mb-3">
                                   <label className="form-label fw-bold small text-uppercase text-white-50">2. Research Field</label>
                                   <select
                                       className="form-select"
                                       value={field}
                                       onChange={e => setField(e.target.value)}
                                       required
                                   >
                                       <option value="" disabled>Select Field</option>
                                       {SCIENTIFIC_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
                                   </select>
                               </div>

                               <div className="mb-4">
                                    <label className="form-label fw-bold small text-uppercase text-white-50">3. Attach Context (Optional)</label>
                                    <input 
                                        type="file" 
                                        className="form-control form-control-sm border-secondary" 
                                        accept=".txt,.md,.csv,.json,.js,.py"
                                        onChange={handleAttachment}
                                        disabled={isAnalyzingFile}
                                        ref={fileInputRef}
                                    />
                                    <div className="form-text text-white-50">
                                        {isAnalyzingFile ? 
                                            <span className="text-primary-glow"><span className="spinner-border spinner-border-sm me-2"></span>Extracting knowledge graph...</span> : 
                                            "Upload notes or data (.txt, .md, .csv). The AI will extract facts relevant to your Title and append them below."
                                        }
                                    </div>
                               </div>

                                <div className="mb-3">
                                     <label className="form-label fw-bold small text-uppercase text-white-50">4. Detailed Description</label>
                                     <textarea 
                                        className="form-control" 
                                        placeholder="Describe your idea..." 
                                        value={description} 
                                        onChange={e => setDescription(e.target.value)} 
                                        required 
                                        rows={10}
                                    ></textarea>
                                </div>

                                <div className="alert alert-warning border-warning border-opacity-25 bg-warning bg-opacity-10 p-3 mb-4 rounded-3 small">
                                    <div className="d-flex gap-2">
                                        <i className="bi bi-exclamation-circle-fill fs-5"></i>
                                        <div>
                                            <strong>Research Integrity Protocol:</strong>
                                            <p className="mb-2 mt-1">
                                                Please describe your idea fully, including specific researcher names, references to existing work, and attach any preliminary work products using the uploader above.
                                            </p>
                                            <p className="mb-0">
                                                <strong>Note:</strong> Automated data generation techniques are useful for <em>ideation and theoretical investigation</em>. However, for actual research, you must use <strong>Manual Mode</strong>. This requires you to provide explicit guidance at each step, perform actual experimental procedures (in-lab or computational), and use the real data derived from those procedures to ensure valid results.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                 <button type="submit" className="btn btn-primary btn-lg w-100" disabled={keyStatus.type === 'none' || isAnalyzingFile}>
                                    Start Discovery Journey
                                 </button>
                             </form>
                        </div>
                     </div>
                </div>
            </section>

            <section className="py-5">
                <div className="container">
                    {savedProjects.length > 0 && (
                        <div className="row mb-5">
                            <div className="col-lg-8 mx-auto">
                                <h4 className="fw-bold mb-4">Continue Previous Research</h4>
                                <div className="list-group">
                                    {savedProjects.map(project => (
                                        <div key={project.id} className="list-group-item d-flex justify-content-between align-items-center p-3">
                                            <div>
                                                <h6 className="mb-1 text-primary-glow">{project.title}</h6>
                                                <small className="text-white-50">{project.field} - Modified {new Date(project.updatedAt || project.createdAt).toLocaleDateString()}</small>
                                            </div>
                                            <div className="btn-group">
                                                <button className="btn btn-sm btn-primary" onClick={() => selectExperiment(project.id)}>ACCESS</button>
                                                <button className="btn btn-sm btn-outline-danger" onClick={() => deleteExperiment(project.id)}><i className="bi bi-trash"></i></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    <ResearchSummary />
                    
                    <div className="row text-center my-5">
                        <div className="col-md-10 mx-auto">
                            <h2 className="fw-bold">Intelligent Research Workflow</h2>
                            <p className="lead text-white-50">Democratizing scientific discovery through multi-modal AI agents.</p>
                        </div>
                    </div>

                    <div className="row g-4">
                        <div className="col-md-4">
                            <div className="card h-100 p-4">
                                <div className="feature-icon mb-3"><i className="bi bi-journal-check h1 text-primary-glow"></i></div>
                                <h5 className="fw-bold">Structured Timeline</h5>
                                <p className="text-white-50">Follow a rigorous 10-step scientific process, from literature review to peer-reviewed publication.</p>
                            </div>
                        </div>
                        <div className="col-md-4">
                            <div className="card h-100 p-4">
                                <div className="feature-icon mb-3"><i className="bi bi-robot h1 text-primary-glow"></i></div>
                                <h5 className="fw-bold">Agentic Discovery</h5>
                                <p className="text-white-50">Deploy specialized AI agents for autonomous data simulation, complex analysis, and editorial polish.</p>
                            </div>
                        </div>
                         <div className="col-md-4">
                            <div className="card h-100 p-4">
                                <div className="feature-icon mb-3"><i className="bi bi-safe h1 text-primary-glow"></i></div>
                                <h5 className="fw-bold">Local & Secure</h5>
                                <p className="text-white-50">Your research data never leaves your machine. Everything is stored locally in your browser's secure database.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            <style>{`
                .animate-in {
                    animation: fadeIn 0.3s ease-in-out;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};