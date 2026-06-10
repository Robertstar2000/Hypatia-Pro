import React, { useState, useEffect, useRef } from 'react';
import { useExperiment, runDataQA } from '../../../services';
import { useToast } from '../../../toast';
import { parseGeminiError, callGeminiWithRetry, safeGetText } from '../../../services';
import { AgenticAnalysisView } from '../../common/AgenticAnalysisView';
import { SCIENCE_LIB } from '../../../utils/scienceLib';

export const CodeSimulator = ({ onComplete, context }) => {
    const { activeExperiment, updateExperiment, isAuthenticated } = useExperiment();
    const [code, setCode] = useState(activeExperiment.stepData[6]?.input || '');
    const [isInitializing, setIsInitializing] = useState(false);
    const [initLogs, setInitLogs] = useState([]);
    const { addToast } = useToast();
    const workerRef = useRef<Worker | null>(null);
    const workerUrlRef = useRef<string | null>(null);
    const isMounted = useRef(true);

    const [agenticRun, setAgenticRun] = useState({
        status: 'idle', 
        logs: [],
        iterations: 0,
        maxIterations: 25,
    });

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);
    
    useEffect(() => {
        const createWorker = () => {
            const workerCode = `
                ${SCIENCE_LIB}
                self.onmessage = (event) => {
                    const { code } = event.data;
                    let finished = false;
                    const hypatia = {
                        finish: (data, summary) => {
                            self.postMessage({ type: 'finish', payload: { data, summary } });
                            finished = true;
                        }
                    };
                    const consoleProxy = {
                        log: (...args) => {
                            const logMsg = args.map(arg => String(arg)).join(' ');
                            self.postMessage({ type: 'log', payload: logMsg });
                        }
                    };
                    try {
                        new Function('console', 'hypatia', 'science', code)(consoleProxy, hypatia, science);
                        if (!finished) self.postMessage({ type: 'done' });
                    } catch (e) {
                        self.postMessage({ type: 'error', payload: \`[\${e.name}] \${e.message}\` });
                    }
                };
            `;
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            const url = URL.createObjectURL(blob);
            workerUrlRef.current = url;
            return new Worker(url);
        };
        workerRef.current = createWorker();
        return () => { 
            if (workerRef.current) workerRef.current.terminate(); 
            if (workerUrlRef.current) URL.revokeObjectURL(workerUrlRef.current);
        };
    }, []);

    useEffect(() => {
        if (!code && isAuthenticated) {
            const runInitializationAgent = async () => {
                if (!isMounted.current) return;
                setIsInitializing(true);
                const log = (agent, message) => {
                    if (isMounted.current) setInitLogs(prev => [...prev, { agent, message }]);
                };
                try {
                    log('Simplifier', 'Extracting experimental variables from methodology...');
                    
                    const simplifierPrompt = `
                        ACT AS: Senior Research Data Scientist.
                        TASK: Translate the following Experimental Methodology into a logical simulation specification for a coder.

                        INPUT CONTEXT:
                        - Hypothesis: "${context.hypothesis}"
                        - Methodology: "${context.methodology_summary?.substring(0, 5000)}"

                        OUTPUT SPECIFICATION:
                        1. Identify the **Independent Variable**.
                        2. Identify the **Dependent Variable**.
                        3. Define a **plausible mathematical relationship** (Linear, Logarithmic, etc.).
                        4. Specify **Sample Size** (target 30-50 points) and **Data Types**.
                        
                        Provide clear, step-by-step logic for the simulation code.
                    `;
                    
                    const simplifierResponse = await callGeminiWithRetry('gemini-3-flash-preview', { 
                        contents: simplifierPrompt 
                    });
                    if (!isMounted.current) return;
                    const instructions = safeGetText(simplifierResponse);
                    
                    log('Coder', 'Generating autonomous simulation script...');
                    
                    const coderPrompt = `
                        ACT AS: Scientific JavaScript Developer.
                        TASK: Write a JavaScript Web Worker script to simulate the experiment.

                        SIMULATION LOGIC SPEC:
                        ${instructions}

                        CRITICAL PERFORMANCE REQUIREMENTS:
                        1. **Perfect Formatting**: Generate a valid CSV string with clear headers.
                        2. **No Nulls**: Every row MUST have data in every column. Avoid empty cells.
                        3. **Organic Variance**: Add Math.random() noise to dependent variables.
                        4. **Final Handoff**: Call \`hypatia.finish(csvData, summary)\`.
                        
                        AVAILABLE SCIENTIFIC LIBRARY (\`science\` object):
                        - physics: G, c, g, calculateGravity(m1, m2, r), calculateForce(m, a), calculateKineticEnergy(m, v), calculatePotentialEnergy(m, h, g), calculateVelocity(v0, a, t), calculateDisplacement(v0, a, t)
                        - chemistry: R, N_A, calculateMolarity(moles, volume), calculatePH(hConcentration), calculateReactionRate(k, concentrations), calculateIdealGas(p, v, n, t), calculateArrhenius(A, Ea, T)
                        - stats: normalRandom(mean, stdDev), clamp(val, min, max), lerp(a, b, t), noise(val, intensity)
                        
                        RESTRICTIONS:
                        - NO DOM access.
                        - Use \`console.log\` for debugging.
                        - Use the \`science\` library for physical/chemical logic where applicable.

                        Example Format:
                        const csv = "id,val\\n1,10.2\\n2,12.5";
                        hypatia.finish(csv, "Simulated data generated.");

                        Output ONLY the raw JavaScript code.`;
                    
                    const coderResponse = await callGeminiWithRetry('gemini-3-flash-preview', { 
                        contents: coderPrompt 
                    });
                    if (!isMounted.current) return;
                    const initialCode = safeGetText(coderResponse).trim().replace(/```javascript/g, '').replace(/```/g, '');
                    setCode(initialCode);
                    log('Coder', 'Initial script ready for testing.');
                } catch (err) {
                    if (isMounted.current) addToast("Failed to initialize coder.", "danger");
                } finally { 
                    if (isMounted.current) setIsInitializing(false); 
                }
            };
            runInitializationAgent();
        }
    }, [isAuthenticated, context, code, addToast]);

    const executeCodeInWorker = (codeToRun: string): Promise<any> => {
        return new Promise((resolve, reject) => {
            let timeoutId: any;
            const messageHandler = (event) => {
                const { type, payload } = event.data;
                if (type === 'log' && isMounted.current) {
                    setAgenticRun(prev => ({ ...prev, logs: [...prev.logs, { agent: 'Simulator', message: payload }] }));
                }
                if (type === 'finish' || type === 'done' || type === 'error') {
                    clearTimeout(timeoutId);
                    workerRef.current?.removeEventListener('message', messageHandler);
                    if (type === 'error') reject(payload); else resolve({ type, payload });
                }
            };
            timeoutId = setTimeout(() => {
                workerRef.current?.removeEventListener('message', messageHandler);
                workerRef.current?.terminate();
                reject("Execution Timeout: Simulation hung for over 30 seconds.");
            }, 30000);
            workerRef.current?.addEventListener('message', messageHandler);
            workerRef.current?.postMessage({ code: codeToRun });
        });
    };

    const runAgenticSimulation = async () => {
        if (agenticRun.status === 'running') return;
        setAgenticRun(prev => ({ ...prev, status: 'running', logs: [], iterations: 0 }));
        
        let currentCode = code;
        for (let i = 0; i < agenticRun.maxIterations; i++) {
            if (!isMounted.current) return;
            setAgenticRun(prev => ({ 
                ...prev, 
                iterations: i + 1, 
                logs: [...prev.logs, { agent: 'System', message: `Attempt ${i + 1}: Running simulation...` }] 
            }));
            
            try {
                const result = await executeCodeInWorker(currentCode);
                if (!isMounted.current) return;
                
                if (result.type === 'finish') {
                    setAgenticRun(prev => ({ ...prev, logs: [...prev.logs, { agent: 'QA Auditor', message: 'Analyzing simulation output for formatting integrity...' }] }));
                    const qaResult = await runDataQA(result.payload.data, context);
                    
                    if (qaResult.is_valid && qaResult.quality_score > 0.5) {
                        setAgenticRun(prev => ({ ...prev, status: 'success' }));
                        onComplete(result.payload.data, result.payload.summary);
                        return;
                    } else {
                        throw new Error(`QA Failure: ${qaResult.issues.join(', ')}`);
                    }
                }
                throw new Error("Simulation execution completed but finish() was never invoked.");
            } catch (error) {
                if (!isMounted.current) return;
                const isLastAttempt = i === agenticRun.maxIterations - 1;
                const message = isLastAttempt ? `Issue detected: ${error}. Triggering Self-Healing Loop.` : `Attempt failed, retrying...`;
                setAgenticRun(prev => ({ 
                    ...prev, 
                    logs: [...prev.logs, { agent: 'Debugger', message }] 
                }));
                
                const debuggerPrompt = `DEBUGGER LOG: The simulation code or output failed formatting/content checks. 
                ISSUE: "${error}". 
                MISSION: Fix the logic. Ensure hypatia.finish(csvData, summary) is called. NO empty columns. PERFECT CSV formatting.
                
                AVAILABLE SCIENTIFIC LIBRARY (\`science\` object):
                - physics: G, c, g, calculateGravity, calculateForce, calculateKineticEnergy, calculatePotentialEnergy, calculateVelocity, calculateDisplacement
                - chemistry: R, N_A, calculateMolarity, calculatePH, calculateReactionRate, calculateIdealGas, calculateArrhenius
                - stats: normalRandom, clamp, lerp, noise

                CODE:
                ${currentCode}`;
                
                try {
                    const res = await callGeminiWithRetry('gemini-3-flash-preview', { contents: debuggerPrompt });
                    if (isMounted.current) {
                        currentCode = safeGetText(res).trim().replace(/```javascript/g, '').replace(/```/g, '');
                        setCode(currentCode);
                        await new Promise(r => setTimeout(r, 1000));
                    }
                } catch (e) {
                    if (isMounted.current) addToast("Self-healing link unstable.", "warning");
                }
            }
        }
        if (isMounted.current) setAgenticRun(prev => ({ ...prev, status: 'failed' }));
    };

    return (
        <div>
            <div className="doc-section mb-3">
                <h6 className="fw-bold">AI Agent Simulation Hub</h6>
                <p className="small text-white-50">Simulation protocol: Enforcing perfect CSV structure and complete data capture.</p>
            </div>
            {isInitializing && <AgenticAnalysisView agenticRun={{logs: initLogs, iterations: 0, maxIterations: 0}} title="Coder Agent Initializing..." />}
            <textarea 
                id="code-editor" 
                className="form-control mb-3 font-monospace bg-black text-primary-glow border-secondary border-opacity-25" 
                style={{ height: '300px', fontSize: '0.85rem' }}
                value={code} 
                onChange={(e) => setCode(e.target.value)} 
            />
            <button className="btn btn-primary w-100" onClick={runAgenticSimulation} disabled={!code || agenticRun.status === 'running'}>
                {agenticRun.status === 'running' ? 'Simulating & Auditing...' : 'Start Agentic Simulation'}
            </button>
            {agenticRun.logs.length > 0 && <AgenticAnalysisView agenticRun={agenticRun} title="Self-Healing Debugger Log" />}
        </div>
    );
};