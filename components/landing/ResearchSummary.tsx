
import React from 'react';
import { useExperiment } from '../../services';
import { WORKFLOW_STEPS } from '../../config';

export const ResearchSummary = () => {
    const { experiments, selectExperiment } = useExperiment();
    const latestExperiment = experiments.length > 0 ? experiments[0] : null;

    if (!latestExperiment) return null;

    const handleContinueResearch = () => {
        if (latestExperiment) {
            selectExperiment(latestExperiment.id);
        }
    };

    // Defensively find the last step with any output by inspecting actual keys
    const lastStepWithOutput = latestExperiment.stepData
        ? Object.keys(latestExperiment.stepData)
            .map(Number)
            .filter(k => !isNaN(k) && k > 0) // Ensure we only consider valid numeric step keys
            .sort((a, b) => b - a)
            .find(stepId => latestExperiment.stepData[stepId]?.summary || latestExperiment.stepData[stepId]?.output)
        : null;

    // Defensively get the summary text, ensuring it is always a string.
    let summaryText = 'No summary available yet.';
    if (lastStepWithOutput && latestExperiment.stepData && latestExperiment.stepData[lastStepWithOutput]) {
        summaryText = latestExperiment.stepData[lastStepWithOutput].summary || latestExperiment.stepData[lastStepWithOutput].output || summaryText;
    }
    
    // Defensively get the current step's title to prevent crashes on invalid step numbers.
    const currentStepInfo = latestExperiment.currentStep > 0 && latestExperiment.currentStep <= WORKFLOW_STEPS.length 
        ? WORKFLOW_STEPS[latestExperiment.currentStep - 1].title 
        : "Completed";


    return (
        <section className="research-summary-section">
            <div className="row">
                <div className="col-lg-8 mx-auto">
                     <h2 className="section-title text-center mb-4">Your Latest Research</h2>
                     <div className="card" onClick={handleContinueResearch} style={{cursor: 'pointer'}} title="Click to continue this project">
                        <div className="card-body">
                            <h5 className="card-title text-primary-glow">{latestExperiment.title}</h5>
                            <h6 className="card-subtitle mb-2 text-white-50">{latestExperiment.field}</h6>
                            <blockquote className="p-3">
                                <p className="mb-0 fst-italic">"{summaryText.substring(0, 200)}{summaryText.length > 200 ? '...' : ''}"</p>
                            </blockquote>
                            <p className="mt-3 small text-white-50">Currently at: Step {latestExperiment.currentStep} - {currentStepInfo}</p>
                        </div>
                        <div className="card-footer bg-transparent border-top-0 text-end">
                            <button className="btn btn-primary" onClick={handleContinueResearch}>Continue Project <i className="bi bi-arrow-right"></i></button>
                        </div>
                     </div>
                </div>
            </div>
        </section>
    );
};