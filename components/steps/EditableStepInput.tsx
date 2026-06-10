
import React, { useState, useEffect } from 'react';
import { useExperiment } from '../../services';
import { useToast } from '../../toast';

export const EditableStepInput = ({ stepId }) => {
    const { activeExperiment, updateExperiment } = useExperiment();
    const { addToast } = useToast();
    const stepData = activeExperiment.stepData[stepId] || {};
    const [inputValue, setInputValue] = useState(stepData.input || '');

    useEffect(() => {
        setInputValue(stepData.input || '');
    }, [stepData.input]);

    const handleSaveInput = () => {
        const updatedStepData = { 
            ...activeExperiment.stepData,
            [stepId]: { ...(activeExperiment.stepData[stepId] || {}), input: inputValue }
        };
        updateExperiment({ ...activeExperiment, stepData: updatedStepData });
        addToast("Input saved.", "success");
    };

    return (
        <div className="mb-3">
            <label htmlFor={`step-input-${stepId}`} className="form-label fw-bold">Step Input</label>
            <textarea
                id={`step-input-${stepId}`}
                className="form-control"
                rows={4}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onBlur={handleSaveInput}
            />
             <div className="form-text">This input will be used to generate the content for this step. It saves automatically when you click away.</div>
        </div>
    );
};