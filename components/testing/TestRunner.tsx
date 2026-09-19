
import React, { useState, useEffect, useRef } from 'react';
import { appTests } from '../../index.test';

export const TestRunner = () => {
    const [results, setResults] = useState([]);
    const [isRunning, setIsRunning] = useState(false);
    
    const isMounted = useRef(true);
    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    const runTests = async () => {
        setIsRunning(true);
        const testResults = [];
        // Clear previous results
        setResults([]);
        
        for (const test of appTests) {
            if (!isMounted.current) return; // Cancel execution if unmounted
            
            try {
                await test.fn();
                testResults.push({ name: test.name, passed: true });
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                testResults.push({ name: test.name, passed: false, error: errorMsg });
            }
            // Update UI progressively
            if (isMounted.current) {
                setResults([...testResults]);
            }
        }
        if (isMounted.current) {
            setIsRunning(false);
        }
    };

    useEffect(() => {
        runTests();
    }, []);

    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.filter(r => !r.passed).length;

    return (
        <div className="container py-4">
            <div className="card shadow-lg bg-dark border-secondary">
                <div className="card-header d-flex justify-content-between align-items-center py-3">
                    <div>
                        <h4 className="mb-0 fw-bold"><i className="bi bi-shield-shaded me-2 text-primary-glow"></i>System Health Audit</h4>
                        <p className="small text-white-50 mb-0">Validating research logic, archival protocols, and agentic workflows.</p>
                    </div>
                    <button className="btn btn-primary" onClick={runTests} disabled={isRunning}>
                        {isRunning ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                Auditing...
                            </>
                        ) : (
                            <><i className="bi bi-play-fill me-1"></i> Run Full Audit</>
                        )}
                    </button>
                </div>
                <div className="card-body">
                    {results.length > 0 && (
                        <div className="d-flex gap-4 mb-4 p-3 bg-black rounded-3 border border-secondary border-opacity-25">
                            <div className="text-center">
                                <div className="h3 mb-0 text-success fw-bold">{passedCount}</div>
                                <div className="small text-white-50 text-uppercase ls-1">Passed</div>
                            </div>
                            <div className="text-center">
                                <div className="h3 mb-0 text-danger fw-bold">{failedCount}</div>
                                <div className="small text-white-50 text-uppercase ls-1">Failed</div>
                            </div>
                            <div className="text-center">
                                <div className="h3 mb-0 text-primary-glow fw-bold">{results.length}</div>
                                <div className="small text-white-50 text-uppercase ls-1">Total</div>
                            </div>
                        </div>
                    )}

                    <div className="test-results-list">
                        {results.length === 0 && !isRunning && (
                            <div className="text-center p-5 text-white-50">
                                <i className="bi bi-clipboard2-pulse mb-3 d-block" style={{fontSize: '3rem', opacity: 0.3}}></i>
                                <p>No audit results yet. Click "Run Full Audit" to begin.</p>
                            </div>
                        )}
                        
                        {results.map((result, index) => (
                            <div key={index} className={`d-flex align-items-start p-3 mb-2 rounded-2 border ${result.passed ? 'border-success border-opacity-25 bg-success bg-opacity-10' : 'border-danger border-opacity-25 bg-danger bg-opacity-10'}`}>
                                <div className="me-3">
                                    {result.passed ? (
                                        <i className="bi bi-check-circle-fill text-success fs-5"></i>
                                    ) : (
                                        <i className="bi bi-exclamation-triangle-fill text-danger fs-5"></i>
                                    )}
                                </div>
                                <div className="flex-grow-1">
                                    <div className={`fw-semibold ${result.passed ? 'text-success' : 'text-danger'}`}>{result.name}</div>
                                    {!result.passed && (
                                        <div className="mt-1 p-2 bg-dark rounded font-monospace small text-danger border border-danger border-opacity-10">
                                            {result.error || "Unknown error occurred"}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {isRunning && (
                            <div className="text-center p-4">
                                <div className="spinner-grow text-primary-glow" role="status"></div>
                                <p className="mt-2 text-white-50 animate-pulse">Scanning archival nodes...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            <style>{`
                .animate-pulse {
                    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: .5; }
                }
                .ls-1 { letter-spacing: 0.05rem; }
            `}</style>
        </div>
    );
};