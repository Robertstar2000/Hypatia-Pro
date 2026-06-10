
import React, { useState, useMemo, useEffect } from 'react';
import { useExperiment } from '../../../services';
import { useToast } from '../../../toast';
import { ModeSelection } from './ModeSelection';
import { CodeSimulator } from './CodeSimulator';
import { ManualDataEntry } from './ManualDataEntry';
import { DataSynthesizer } from './DataSynthesizer';
import { DataUploader } from '../../landing/DataUploader';
import { cleanAndFormatCsv } from '../../../utils/csvUtils';

type ExperimentMode = 'simulate' | 'manual' | 'synthesize' | 'upload';

export const ExperimentRunner = ({ onStepComplete }) => {
    const [mode, setMode] = useState<ExperimentMode | null>(null);
    const { addToast } = useToast();
    const { activeExperiment } = useExperiment();

    // Auto-select mode for automated workflows
    useEffect(() => {
        if (activeExperiment?.automationMode === 'automated' && !mode) {
            // Default to 'simulate' as it provides more rigorous results than 'synthesize' 
            // but is still fully automated.
            setMode('simulate');
            addToast("Agentic Override: Initializing Code Simulation...", "info");
        }
    }, [activeExperiment?.automationMode, mode, addToast]);

    const handleDataSubmission = async (data: string, summary: string) => {
        const cleanedData = cleanAndFormatCsv(data);
        
        // Pass data to parent to handle state transition
        onStepComplete({
            output: summary,
            summary: summary,
            input: cleanedData 
        });
        
        addToast("Experimental dataset generated and verified.", "success");
    };

    const context = useMemo(() => ({
        hypothesis: activeExperiment.stepData[3]?.output || "N/A",
        methodology_summary: activeExperiment.stepData[4]?.summary || activeExperiment.stepData[4]?.output || "N/A",
        data_collection_plan_summary: activeExperiment.stepData[5]?.summary || activeExperiment.stepData[5]?.output || "N/A"
    }), [activeExperiment]);

    if (!mode) {
        return <ModeSelection onSelect={setMode} />;
    }

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-3">
                <button 
                    className="btn btn-sm btn-outline-secondary" 
                    onClick={() => setMode(null)}
                    disabled={activeExperiment?.automationMode === 'automated'}
                >
                    <i className="bi bi-arrow-left me-1"></i> Change Method
                </button>
                <span className="badge bg-primary text-uppercase">{mode} Mode</span>
            </div>

            <div className="experiment-mode-container card p-4">
                {mode === 'upload' && <DataUploader onComplete={handleDataSubmission} />}
                {mode === 'simulate' && <CodeSimulator onComplete={handleDataSubmission} context={context} />}
                {mode === 'manual' && <ManualDataEntry onComplete={handleDataSubmission} context={context} />}
                {mode === 'synthesize' && <DataSynthesizer onComplete={handleDataSubmission} context={context} />}
            </div>
        </div>
    );
};
