
import { Experiment, FineTuneSettings } from '../config';
import { extractJson } from './api';

/**
 * Retrieves context from previous steps to inform the current prompt.
 * Instead of passing massive full-text outputs, it favors the 'summary' field logic for efficiency.
 */
export const getStepContext = async (experiment: Experiment, currentStepId: number) => {
    const data = experiment.stepData || {};
    
    // Helper to get summary or output, with JSON awareness
    const getC = (step: number) => {
        if (!data[step]) return "Not yet generated.";
        const content = data[step].summary || data[step].output || "Not yet generated.";
        
        // If the content is JSON (common in Step 1, 2, 7), try to extract the descriptive part
        if (content.trim().startsWith('{') || content.includes('```json')) {
            try {
                const parsed = JSON.parse(extractJson(content));
                
                // Special handling for Step 2 to include actionable data
                if (step === 2 && parsed.synthesis_narrative) {
                    return `${parsed.synthesis_narrative}\n\nACTIONABLE GAPS: ${parsed.evidence_gaps?.join('; ')}\nMECHANISMS: ${parsed.candidate_mechanisms?.join('; ')}`;
                }

                // Prefer specific summary fields depending on the step
                return parsed.summary || parsed.synthesis_narrative || parsed.research_question || content;
            } catch (e) {
                return content;
            }
        }
        return content;
    };

    return {
        experimentField: experiment.field,
        question: getC(1),
        literature_review_summary: getC(2),
        hypothesis: getC(3),
        methodology_summary: getC(4),
        data_collection_plan_summary: getC(5),
        experimental_data_summary: getC(6), 
        analysis_summary: getC(7),
        conclusion_summary: getC(8),
        references: (() => {
            try {
                return data[2]?.output ? JSON.parse(extractJson(data[2].output)).references : [];
            } catch (e) {
                return [];
            }
        })(),
        full_project_summary_log: Object.entries(data)
            .filter(([k, v]) => parseInt(k) < currentStepId && (v.summary || v.output))
            .map(([k, v]) => {
                const stepContent = getC(parseInt(k));
                return `Step ${k}: ${stepContent.substring(0, 500)}${stepContent.length > 500 ? '...' : ''}`;
            })
            .join('\n')
    };
};

/**
 * Main prompt factory. Returns the prompt string, JSON expectation flag, and configuration constraints.
 */
export const getPromptForStep = (
    stepId: number, 
    input: string, 
    context: any, 
    fineTune: FineTuneSettings,
    feedback: string = ""
) => {
    let basePrompt = "";
    let expectJson = false;
    let config: any = {};

    const role = `You are Hypatia, an advanced Research Scientist AI specializing in ${context.experimentField}. You adhere to the Scientific Method rigorously.`;
    const feedbackInstruction = feedback ? `\n\nUSER FEEDBACK ON PREVIOUS DRAFT (INCORPORATE THIS): "${feedback}"` : "";

    switch (stepId) {
        case 1: // Question
            expectJson = true;
            basePrompt = `${role}
            Analyze the user's initial research idea and formulate a rigorous, falsifiable Research Question.
            
            USER INPUT: "${input}"
            
            CRITICAL: YOU MUST OUTPUT ONLY VALID JSON matching the specified schema.
            The JSON must include:
            - "research_question": The refined question.
            - "study_type": One of ['observational', 'simulation', 'benchmarking', 'controlled_experiment', 'qualitative'].
            - "uniqueness_score": A float 0-1 (1 is highly novel).
            - "justification": Why is this unique?
            - "measurable_outcomes": Array of strings.
            
            ${feedbackInstruction}`;
            break;

        case 2: // Lit Review
            expectJson = true;
            basePrompt = `${role}
            Conduct a rigorous literature review search and synthesis.
            
            Literature review for: "${context.question}"
            SEARCH DEPTH: ${fineTune.depth || 'standard'}
            
            Output JSON matching the schema with:
            - "synthesis_narrative": Markdown summary of state-of-the-art.
            - "evidence_gaps": List of missing knowledge this study addresses.
            - "candidate_mechanisms": Theoretical underpinnings.
            - "references": Array of citations. IMPORTANT: Use only real, verifiable references.
            
            ${feedbackInstruction}`;
            break;

        case 3: // Hypothesis
            basePrompt = `${role}
            Formulate 3 distinct hypotheses based on the literature gaps.
            
            LIT REVIEW CONTEXT: ${context.literature_review_summary}
            RESEARCH QUESTION: ${context.question}
            
            Output Format:
            1. **Null Hypothesis ($H_0$)**: ...
            2. **Alternative Hypothesis 1 ($H_1$)**: ...
            3. **Alternative Hypothesis 2 ($H_2$)**: ...
            
            ${feedbackInstruction}`;
            break;

        case 4: // Methodology
            basePrompt = `${role}
            Draft a Detailed experimental methodology for:
            
            HYPOTHESIS: ${context.hypothesis}
            
            Include:
            - Study Design.
            - Variables (Independent, Dependent, Control).
            - Materials & Equipment (specifically list necessary hardware, software, or reagents).
            - Test Subjects or Participants (if applicable, define inclusion/exclusion criteria).
            - Detailed, numbered Step-by-step Procedure.
            - Validation: Explicitly compare how the expected results (especially if derived from simulation) will be compared against actual real-world data or ground truth to verify accuracy.
            
            ${feedbackInstruction}`;
            break;

        case 5: // Data Plan
            basePrompt = `${role}
            Create a Data collection plan for methodology:
            
            METHODOLOGY: ${context.methodology_summary}
            
            Define data capture format and measurement frequency.
            ${feedbackInstruction}`;
            break;

        case 7: // Analysis
            expectJson = true;
            basePrompt = `${role}
            Analyze data: csvData provided in system context.
            
            CONTEXT:
            - Question: ${context.question}
            - Hypothesis: ${context.hypothesis}
            
            Execute statistical tests.
            Output JSON with "summary", "statistical_outputs", and "charts".
            
            ${feedbackInstruction}`;
            break;

        case 8: // Conclusion
            basePrompt = `${role}
            Synthesize the findings from the analysis node.
            
            ANALYSIS RESULTS: ${context.analysis_summary}
            ORIGINAL HYPOTHESIS: ${context.hypothesis}
            
            Evaluate supporting evidence, discuss limitations, and define robustness.
            ${feedbackInstruction}`;
            break;

        case 9: // Peer Review
            basePrompt = `${role}
            Simulate a skeptical peer review of this project.
            
            PROJECT LOG:
            ${context.full_project_summary_log}
            
            Focus on: ${fineTune.reviewerPersona || 'Methodological Flaws'}.
            ${feedbackInstruction}`;
            break;

        case 10: // Publication
            basePrompt = `${role}
            Draft a comprehensive scientific publication based on the entire project log.
            
            PROJECT LOG:
            ${context.full_project_summary_log}
            
            Structure: Abstract, Introduction, Methods, Results, Discussion, References.
            ${feedbackInstruction}`;
            break;
            
        case 13: // Explanation
             basePrompt = `${role}
             Explain the findings of this research paper in simple terms for a general audience.
             
             PROJECT CONTEXT:
             ${context.conclusion_summary}
             `;
             break;

        default:
            basePrompt = `${role} Generate content for step ${stepId}. input: ${input}`;
    }

    return { basePrompt, expectJson, config };
};