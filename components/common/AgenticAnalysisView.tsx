import React, { useRef, useEffect } from 'react';

export const AgenticAnalysisView = ({ agenticRun, title = "AI Agents at Work...", subtitle = "A multi-agent workflow is running." }) => {
    const logsEndRef = useRef(null);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [agenticRun.logs]);
    
    return (
        <div className="agentic-analysis-view border border-secondary border-opacity-10 rounded-3 bg-black bg-opacity-20 p-4 mb-4">
            <div className="text-center mb-4">
                <h5 className="fw-bold mb-1 text-primary-glow">{title}</h5>
                <p className="text-white-50 small">{subtitle}</p>
            </div>
            
            {agenticRun.maxIterations > 0 && (
                <div className="mb-4">
                    <div className="d-flex justify-content-between mb-1">
                        <span className="small text-white-50 text-uppercase ls-1">Cognitive Cycles</span>
                        <span className="small text-primary-glow fw-bold">{agenticRun.iterations} / {agenticRun.maxIterations}</span>
                    </div>
                    <div className="progress bg-dark" style={{height: '10px', borderRadius: '5px'}}>
                        <div 
                            className="progress-bar progress-bar-striped progress-bar-animated bg-primary-glow shadow-glow" 
                            style={{ width: `${(agenticRun.iterations / agenticRun.maxIterations) * 100}%` }}
                        ></div>
                    </div>
                </div>
            )}
            
            <div className="agent-log-container bg-dark bg-opacity-50 rounded border border-secondary border-opacity-10 p-3" 
                 style={{ maxHeight: '300px', overflowY: 'auto', scrollbarWidth: 'thin' }}>
                {agenticRun.logs.length === 0 ? (
                    <div className="text-center py-4 text-white-50 italic small opacity-50">Initializing agent protocol...</div>
                ) : (
                    agenticRun.logs.map((log, index) => (
                        <div key={index} className={`agent-log-entry py-1 border-bottom border-white border-opacity-5 last-border-none agent-log-${log.agent.toLowerCase().replace(/\s+/g, '-')}`}>
                            <span className="agent-log-agent fw-bold text-info me-2" style={{fontSize: '0.75rem', textTransform: 'uppercase'}}>[{log.agent}]</span>
                            <span className="agent-log-message text-white-50" style={{fontSize: '0.85rem'}}>{log.message}</span>
                        </div>
                    ))
                )}
                <div ref={logsEndRef} />
            </div>

            <style>{`
                .shadow-glow {
                    box-shadow: 0 0 10px rgba(0, 242, 254, 0.4);
                }
                .last-border-none:last-child {
                    border-bottom: none !important;
                }
                .agent-log-container::-webkit-scrollbar {
                    width: 4px;
                }
                .agent-log-container::-webkit-scrollbar-track {
                    background: transparent;
                }
                .agent-log-container::-webkit-scrollbar-thumb {
                    background: rgba(0, 242, 254, 0.2);
                    border-radius: 10px;
                }
            `}</style>
        </div>
    );
};