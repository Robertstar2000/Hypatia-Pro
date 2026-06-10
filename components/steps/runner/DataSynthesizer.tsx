import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useExperiment, runDataQA } from '../../../services';
import { useToast } from '../../../toast';
import { parseGeminiError, callGeminiWithRetry, extractJson, safeGetText } from '../../../services';
import { AgenticAnalysisView } from '../../common/AgenticAnalysisView';
import { cleanAndFormatCsv } from '../../../utils/csvUtils';

export const DataSynthesizer = ({ onComplete, context }) => {
    const { isAuthenticated } = useExperiment();
    const [result, setResult] = useState<{ summary: string, csv: string } | null>(null);
    const [agenticRun, setAgenticRun] = useState({
        status: 'idle',
        logs: [],
        iterations: 0,
        maxIterations: 10,
    });
    const { addToast } = useToast();
    
    const isMounted = useRef(true);
    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    const handleSynthesize = useCallback(async () => {
        if (!isAuthenticated || agenticRun.status === 'running') return;
        
        setAgenticRun(prev => ({ ...prev, status: 'running', logs: [], iterations: 0 }));
        let lastFeedback = "";

        for (let i = 0; i < agenticRun.maxIterations; i++) {
            if (!isMounted.current) return;
            
            const attempt = i + 1;
            setAgenticRun(prev => ({ 
                ...prev, 
                iterations: attempt,
                logs: [...prev.logs, { agent: 'Synthesizer', message: `Attempt ${attempt}: Generating plausible data vectors...` }] 
            }));

            const prompt = `DATA PROVENANCE REQUIREMENT: You are synthesizing synthetic data. 
            Based on Methodology: "${context.methodology_summary}" and Data Plan: "${context.data_collection_plan_summary}", generate a plausible estimated dataset.
            
            ${lastFeedback ? `PREVIOUS ATTEMPT FAILED QA: ${lastFeedback}. Fix formatting and ensure data is present in ALL cells.` : ''}

            **CRITICAL**: YOU MUST ENSURE DATA IS PRESENT IN ALL COLUMNS FOR ALL ROWS. NO NULLS.
            
            Output valid JSON object with:
            1. "summary": A brief one-sentence description.
            2. "data": Array of objects, where keys are column names and values are data points.
            
            Output ONLY raw JSON.`;
            
            try {
                const response = await callGeminiWithRetry('gemini-3-flash-preview', { 
                    contents: prompt,
                    config: { responseMimeType: "application/json" }
                });
                if (!isMounted.current) return;
                
                const jsonText = extractJson(safeGetText(response));
                const parsed = JSON.parse(jsonText);
                const summary = parsed.summary || "Data synthesized by AI.";
                const dataArray = parsed.data || [];

                if (!Array.isArray(dataArray) || dataArray.length === 0) throw new Error("Generated data is empty.");

                // Convert to CSV
                const columns = Object.keys(dataArray[0]);
                const csvHeader = columns.join(',');
                const csvRows = dataArray.map((row: any) => 
                    columns.map(col => {
                        const val = row[col] === undefined || row[col] === null ? '' : String(row[col]);
                        return `"${val.replace(/"/g, '""')}"`;
                    }).join(',')
                );
                const rawCsv = [csvHeader, ...csvRows].join('\n');
                const cleanCsv = cleanAndFormatCsv(rawCsv);

                setAgenticRun(prev => ({ ...prev, logs: [...prev.logs, { agent: 'Auditor', message: 'Analyzing dataset structure and completeness...' }] }));
                const qa = await runDataQA(cleanCsv, context);
                
                if (qa.is_valid && qa.quality_score > 0.5) {
                    setResult({ summary, csv: cleanCsv });
                    setAgenticRun(prev => ({ ...prev, status: 'success' }));
                    addToast("Synthetic dataset verified by Auditor.", "success");
                    return;
                } else {
                    lastFeedback = qa.issues.join('; ');
                    setAgenticRun(prev => ({ ...prev, logs: [...prev.logs, { agent: 'Auditor', message: `Dataset rejected: ${lastFeedback}. Retrying generation...` }] }));
                }
            } catch (err) {
                const msg = parseGeminiError(err);
                const isLastAttempt = i === agenticRun.maxIterations - 1;
                const message = isLastAttempt ? `ERROR: ${msg}` : `Attempt failed, retrying...`;
                setAgenticRun(prev => ({ ...prev, logs: [...prev.logs, { agent: 'System', message }] }));
                await new Promise(r => setTimeout(r, 2000));
            }
        }
        setAgenticRun(prev => ({ ...prev, status: 'failed' }));
    }, [isAuthenticated, context, agenticRun.status, agenticRun.maxIterations, addToast]);

    return (
        <div className="data-synthesizer-node">
            {agenticRun.status === 'idle' && (
                <div className="text-center p-4">
                    <h6 className="fw-bold"><i className="bi bi-magic me-2"></i>AI Data Synthesis</h6>
                    <p className="text-white-50 small mb-4">Autonomous generation of high-fidelity theoretical datasets.</p>
                    <button className="btn btn-primary px-5 py-2 rounded-pill" onClick={handleSynthesize}>Execute Synthesis Protocol</button>
                </div>
            )}

            {agenticRun.status === 'running' && (
                <AgenticAnalysisView agenticRun={agenticRun} title="Synthetic Data Orchestration" subtitle="Generating and auditing theoretical data nodes via JSON-first protocol." />
            )}

            {agenticRun.status === 'failed' && (
                <div className="alert alert-danger text-center">
                    <h6>Synthesis protocol aborted.</h6>
                    <p className="text-warning small fw-bold">Human validation required</p>
                    <button className="btn btn-sm btn-outline-danger mt-2" onClick={handleSynthesize}>Re-Initiate</button>
                </div>
            )}

            {agenticRun.status === 'success' && result && (
                <div className="mt-2 animate-in">
                    <div className="alert alert-success border-success border-opacity-25 bg-success bg-opacity-5 p-3 mb-4">
                        <i className="bi bi-check-circle-fill me-2"></i>
                        <strong>QA APPROVED:</strong> Archival integrity score high. Data ready for analysis.
                    </div>
                    <p className="small"><strong>Disclosure:</strong> {result.summary}</p>
                    <textarea className="form-control font-monospace mb-3 bg-black text-primary-glow" readOnly rows={6} value={result.csv} />
                    <button className="btn btn-success w-100 py-2 shadow-sm" onClick={() => onComplete(result.csv, result.summary)}>Load Dataset into Analysis Node</button>
                </div>
            )}
        </div>
    );
};