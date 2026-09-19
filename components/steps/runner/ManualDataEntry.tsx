import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useExperiment, runManualFormQA } from '../../../services';
import { useToast } from '../../../toast';
import { parseGeminiError, callGeminiWithRetry, extractJson, safeGetText } from '../../../services';
import { DYNAMIC_TABLE_SCHEMA } from '../../../config';
import { AgenticAnalysisView } from '../../common/AgenticAnalysisView';
import * as XLSX from 'xlsx';

export const ManualDataEntry = ({ onComplete, context }) => {
    const { isAuthenticated, activeExperiment } = useExperiment();
    const [columns, setColumns] = useState<string[]>([]);
    const [rows, setRows] = useState<Record<string, string>[]>([]);
    const [agenticRun, setAgenticRun] = useState({
        status: 'idle',
        logs: [],
        iterations: 0,
        maxIterations: 5,
    });
    const { addToast } = useToast();
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        if (activeExperiment?.automationMode === 'automated') {
             addToast("Manual Data Entry required. Automation paused for user input.", "info");
        }
        return () => { isMounted.current = false; };
    }, [activeExperiment?.automationMode, addToast]);

    const initializeForm = useCallback(async () => {
        if (!isAuthenticated || agenticRun.status === 'running') return;
        
        setAgenticRun(prev => ({ ...prev, status: 'running', logs: [], iterations: 0 }));
        let lastFeedback = "";
        
        for (let i = 0; i < agenticRun.maxIterations; i++) {
            if (!isMounted.current) return;
            
            try {
                const attempt = i + 1;
                setAgenticRun(prev => ({ 
                    ...prev, 
                    iterations: attempt,
                    logs: [...prev.logs, { agent: 'Architect', message: `Attempt ${attempt}: Generating data entry schema...` }] 
                }));

                const prompt = `ACT AS: Scientific Database Architect.
                Based on the data collection plan: "${context.data_collection_plan_summary}", generate a JSON array of column objects for a data table.
                
                ${lastFeedback ? `CRITICAL FAILURE IN PREVIOUS ATTEMPT: ${lastFeedback}. You MUST fix these structural issues.` : ''}

                REQUIREMENTS:
                1. Output a JSON array where each object has "columnName" and "dataType".
                2. Columns MUST map directly to the variables in the methodology.
                
                Output ONLY raw JSON array.`;

                const response = await callGeminiWithRetry('gemini-3-flash-preview', { 
                    contents: prompt, 
                    config: { responseMimeType: "application/json", responseSchema: DYNAMIC_TABLE_SCHEMA } 
                });
                
                const schemaText = extractJson(safeGetText(response));

                setAgenticRun(prev => ({ ...prev, logs: [...prev.logs, { agent: 'Auditor', message: 'Analyzing schema integrity against methodology...' }] }));
                const qa = await runManualFormQA(schemaText, context);

                if (qa.is_valid && qa.quality_score > 0.6) {
                    const schemaArray = JSON.parse(schemaText);
                    const newColumns = schemaArray.map((col: any) => col.columnName);
                    if (newColumns.length === 0) throw new Error("Architect returned zero columns.");

                    setColumns(newColumns);
                    setRows([Object.fromEntries(newColumns.map((c: string) => [c, '']))]);
                    setAgenticRun(prev => ({ ...prev, status: 'success' }));
                    addToast("Data entry portal initialized and verified.", "success");
                    return;
                } else {
                    lastFeedback = qa.issues.join('; ');
                    setAgenticRun(prev => ({ ...prev, logs: [...prev.logs, { agent: 'Auditor', message: `SCHEMA REJECTED: ${lastFeedback}. Retrying...` }] }));
                    // Small delay to prevent tight-loop 429s during self-healing
                    await new Promise(r => setTimeout(r, 2000));
                }
            } catch (err) {
                const msg = parseGeminiError(err);
                setAgenticRun(prev => ({ ...prev, logs: [...prev.logs, { agent: 'System', message: `RECOVERY MODE: ${msg}` }] }));
                await new Promise(r => setTimeout(r, 3000));
            }
        }
        setAgenticRun(prev => ({ ...prev, status: 'failed' }));
    }, [isAuthenticated, context, agenticRun.status, agenticRun.maxIterations, addToast]);

    useEffect(() => {
        if (columns.length === 0 && agenticRun.status === 'idle') {
            initializeForm();
        }
    }, [columns.length, agenticRun.status, initializeForm]);

    const handleRowChange = (index, col, value) => {
        const newRows = [...rows];
        newRows[index][col] = value;
        setRows(newRows);
    };

    const addRow = () => setRows([...rows, Object.fromEntries(columns.map(c => [c, '']))]);
    const removeRow = (index) => setRows(rows.filter((_, i) => i !== index));

    const handleSubmit = () => {
        if (rows.some(r => Object.values(r).some(v => !(v as string).trim()))) {
            if (!window.confirm("PROTOCOL WARNING: Some fields are empty. This may degrade analysis quality. Proceed anyway?")) return;
        }
        const header = columns.join(',');
        const body = rows.map(row => columns.map(col => `"${(row[col] || '').replace(/"/g, '""')}"`).join(',')).join('\n');
        onComplete(`${header}\n${body}`, "Manually entered forensic data.");
    };

    const handleDownloadTemplate = () => {
        if (columns.length === 0) {
            addToast("Initialize the table structure first.", "warning");
            return;
        }
        try {
            const ws = XLSX.utils.aoa_to_sheet([columns]);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Template");
            XLSX.writeFile(wb, "hypatia_data_template.xlsx");
            addToast("Template downloaded successfully.", "success");
        } catch (e) {
            console.error(e);
            addToast("Failed to generate Excel template.", "danger");
        }
    };

    if (agenticRun.status === 'running') return <AgenticAnalysisView agenticRun={agenticRun} title="Building Data Entry Portal" subtitle="Agents are negotiating table structure and variable mapping." />;

    return (
        <div className="animate-in">
            {agenticRun.status === 'failed' ? (
                <div className="alert alert-danger">
                    <h6 className="fw-bold">Form Generation Protocol Failed</h6>
                    <p className="small mb-2">The AI Architect could not produce a stable schema. This is usually due to an underspecified methodology.</p>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => { setAgenticRun(p => ({...p, status: 'idle'})); setColumns([]); }}>Retry Initialization</button>
                </div>
            ) : (
                <div className="card mb-4 border-secondary border-opacity-25 bg-black bg-opacity-20 shadow-sm">
                    <div className="card-body">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h6 className="fw-bold mb-0">Step 6: Forensic Data Entry</h6>
                            <div className="d-flex gap-2">
                                <button className="btn btn-xs btn-outline-success" onClick={handleDownloadTemplate} title="Download Excel Template" disabled={columns.length === 0}>
                                    <i className="bi bi-file-earmark-excel me-1"></i> Template
                                </button>
                                <button className="btn btn-xs btn-outline-secondary" onClick={() => { if(window.confirm("Reset table structure?")) { setColumns([]); setAgenticRun(p=>({...p, status:'idle'})); }}} title="Re-initialize Architect Agents">
                                    <i className="bi bi-gear-wide-connected"></i>
                                </button>
                            </div>
                        </div>
                        <div className="table-responsive">
                            <table className="table table-bordered border-secondary border-opacity-10 mb-3">
                                <thead className="bg-dark bg-opacity-50">
                                    <tr>{columns.map(c => <th key={c} className="small text-uppercase ls-1">{c}</th>)}<th style={{ width: '50px' }}></th></tr>
                                </thead>
                                <tbody>
                                    {rows.map((row, rowIndex) => (
                                        <tr key={rowIndex}>
                                            {columns.map(col => <td key={col} className="p-1"><input type="text" className="form-control form-control-sm border-0 bg-transparent text-white" value={row[col] || ''} onChange={e => handleRowChange(rowIndex, col, e.target.value)} /></td>)}
                                            <td className="p-1 text-center"><button className="btn btn-sm text-danger" onClick={() => removeRow(rowIndex)} disabled={rows.length <= 1}><i className="bi bi-x-lg"></i></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="d-flex justify-content-between">
                            <button className="btn btn-sm btn-outline-secondary" onClick={addRow}><i className="bi bi-plus-lg me-1"></i> Add Record</button>
                            <button className="btn btn-success px-4" onClick={handleSubmit}><i className="bi bi-check-circle-fill me-1"></i> Finalize Entry</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};