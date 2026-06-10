
import React, { useEffect, useRef } from 'react';
import { renderMarkdown } from '../../utils/markdownRenderer';
import { Chart } from 'chart.js';

/**
 * @component DataAnalysisView
 * A robust component for rendering the output of the data analysis step,
 * which includes a summary and dynamic Chart.js visualizations.
 */
export const DataAnalysisView = ({ analysisData, onError }: { analysisData: any, onError?: (error: string) => void }) => {
    const chartRefs = useRef<Array<HTMLCanvasElement | null>>([]);

    useEffect(() => {
        const charts: any[] = [];
        
        if (analysisData?.charts && Array.isArray(analysisData.charts)) {
            analysisData.charts.forEach((chartData, index) => {
                const canvas = chartRefs.current[index];
                if (canvas && chartData.chartConfig) {
                    try {
                        const config = typeof chartData.chartConfig === 'string' 
                            ? JSON.parse(chartData.chartConfig) 
                            : chartData.chartConfig;
                        
                        // Ensure context exists
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            const newChart = new Chart(ctx, config);
                            charts.push(newChart);
                        } else {
                            console.error("Failed to get 2d context for chart:", chartData.title);
                            if (onError) onError(`Failed to get 2d context for chart: ${chartData.title}`);
                        }
                    } catch (e) {
                        console.error("Failed to render chart:", chartData.title, e);
                        // Display error in the canvas area
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            ctx.fillStyle = 'red';
                            ctx.font = '12px Arial';
                            ctx.fillText('Chart rendering failed', 10, 20);
                            ctx.fillText(String(e), 10, 40);
                            ctx.fillText('Config: ' + JSON.stringify(chartData.chartConfig).substring(0, 50), 10, 60);
                        }
                        if (onError) onError(`Chart "${chartData.title}" failed to render: ${String(e)}`);
                    }
                }
            });
        }

        return () => {
            charts.forEach(chart => chart.destroy());
        };
    }, [analysisData]);

    if (!analysisData || analysisData.summary === undefined) {
        return <div className="alert alert-info">Awaiting analysis results...</div>;
    }

    const hasCharts = Array.isArray(analysisData.charts) && analysisData.charts.length > 0;
    const hasTables = Array.isArray(analysisData.tables) && analysisData.tables.length > 0;

    return (
        <div>
            {analysisData.summary && (
                <div className="generated-text-container" dangerouslySetInnerHTML={{ __html: renderMarkdown(analysisData.summary) }} />
            )}

            {hasTables && (
                <div className="mt-4">
                    <h5 className="fw-bold mb-3"><i className="bi bi-table me-2 text-primary-glow"></i>Statistical Data Tables</h5>
                    <div className="row g-4">
                        {analysisData.tables.map((table, index) => (
                            <div className="col-12" key={index}>
                                <div className="card bg-black border-secondary border-opacity-10 shadow-sm overflow-hidden">
                                    <div className="card-header border-secondary border-opacity-10 bg-dark bg-opacity-25 fw-bold small text-uppercase ls-1">
                                        {table.title || `Data Node ${index + 1}`}
                                    </div>
                                    <div className="card-body p-0">
                                        <div className="table-responsive">
                                            <table className="table table-dark table-hover mb-0 small">
                                                <thead>
                                                    <tr>
                                                        {table.headers.map((h, i) => <th key={i} className="border-secondary border-opacity-10">{h}</th>)}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {table.rows.map((row, i) => (
                                                        <tr key={i}>
                                                            {row.map((cell, j) => <td key={j} className="border-secondary border-opacity-10">{cell}</td>)}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {hasCharts && (
                <div className="mt-4">
                    <h5 className="fw-bold mb-3"><i className="bi bi-bar-chart-fill me-2 text-primary-glow"></i>Experimental Visualizations</h5>
                    <div className="row g-4">
                        {analysisData.charts.map((chart, index) => (
                            <div className="col-lg-6" key={index}>
                                <div className="card h-100 bg-black border-secondary border-opacity-10 shadow-sm">
                                    <div className="card-header border-secondary border-opacity-10 bg-dark bg-opacity-25 fw-bold small text-uppercase ls-1">
                                        {chart.title || `Visual Node ${index + 1}`}
                                    </div>
                                    <div className="card-body p-3" style={{ minHeight: '350px', position: 'relative' }}>
                                        <canvas 
                                            ref={el => { chartRefs.current[index] = el; }}
                                            style={{ width: '100%', height: '100%' }}
                                        ></canvas>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
