import { Experiment, LITERATURE_REVIEW_SCHEMA, DATA_ANALYSIS_IMAGE_OUTPUT_SCHEMA, DATA_QA_SCHEMA, DYNAMIC_TABLE_SCHEMA } from '../config';
import { callGeminiWithRetry, extractJson, isValidJsonForSchema, parseBlockers, safeGetText } from './api';
import { getStepContext } from './prompts';
import { ensureChartStyling } from '../utils/chartUtils';

export const executeStepWorkflow = async (
    modelName: string, 
    params: any, 
    context: any, 
    isJsonMode: boolean, 
    schema: any
): Promise<string> => {
    if (isJsonMode && schema) {
        params.config = { 
            ...params.config, 
            responseMimeType: "application/json", 
            responseSchema: schema 
        };
    }

    const response = await callGeminiWithRetry(modelName, params);
    let output = safeGetText(response);

    if (isJsonMode) {
        output = extractJson(output);
        if (!isValidJsonForSchema(output, schema)) {
            // Self-Correction Loop
            console.warn("Schema validation failed, attempting self-correction...");
            const repairPrompt = `The previous output did not match the required JSON schema. 
            ERROR: Invalid Schema. 
            REQUIRED SCHEMA: ${JSON.stringify(schema)}
            PREVIOUS OUTPUT: ${output}
            
            Fix the JSON structure and return only the valid JSON object. Do not include markdown code blocks.`;
            
            const repairResponse = await callGeminiWithRetry('gemini-3-flash-preview', { contents: repairPrompt, config: { responseMimeType: "application/json", responseSchema: schema } });
            output = extractJson(safeGetText(repairResponse));
        }
    }
    return output;
};


// --- AGENTIC WORKFLOWS ---

/**
 * Manual Form QA Agent: Checks if the generated table schema is valid for data collection.
 */
export const runManualFormQA = async (schemaJson: string, context: any) => {
    const prompt = `
    ACT AS: Scientific Database Architect.
    TASK: Audit the proposed data entry table schema for an experiment.
    
    PROPOSED SCHEMA:
    ${schemaJson}
    
    CONTEXT:
    - Methodology: ${context.methodology_summary}
    - Data Plan: ${context.data_collection_plan_summary}
    
    AUDIT CHECKLIST:
    1. Validity: Is it a non-empty array of column objects?
    2. Alignment: Do columns match the independent and dependent variables in the plan?
    3. Completeness: Are there enough columns to capture the full observation protocol?
    
    If the schema is flawed (e.g., missing keys like "columnName" or "dataType"), you MUST provide a corrected JSON version.
    
    Output ONLY valid JSON matching the QA schema.
    `;

    const response = await callGeminiWithRetry('gemini-3-flash-preview', { 
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: DATA_QA_SCHEMA }
    });
    
    return JSON.parse(extractJson(safeGetText(response)));
};

/**
 * QA Agent to verify experimental data quality before analysis.
 * ENFORCES: Data presence in all columns and correct formatting.
 */
export const runDataQA = async (csvData: string, context: any) => {
    const prompt = `
    ACT AS: Scientific Data Auditor (QA).
    TASK: Verify the structural integrity and scientific plausibility of the following experimental dataset.
    
    DATASET:
    ${csvData.substring(0, 5000)}
    
    RESEARCH CONTEXT:
    - Hypothesis: ${context.hypothesis}
    - Methodology: ${context.methodology_summary}
    
    STRICT COMPLIANCE RULES:
    1. CSV structure: Must have a header row and consistent column counts for every data row.
    2. Data Presence: EVERY column in EVERY row MUST have data. No empty fields or nulls allowed.
    3. Plausibility: Data must represent the variables defined in the methodology. 
    4. Formatting: No stray characters, commas in unquoted fields, or malformed lines.
 
    Output ONLY valid JSON matching the QA schema.
    `;

    const response = await callGeminiWithRetry('gemini-3-flash-preview', { 
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: DATA_QA_SCHEMA }
    });
    
    return JSON.parse(extractJson(safeGetText(response)));
};

export const runDataAnalysisAgent = async ({ experiment, csvData, updateLog, feedback }: { experiment: Experiment, csvData: string, updateLog: (agent: string, msg: string) => void, feedback?: string }) => {
    updateLog('Manager', 'Initiating Data Analysis Agent Swarm...');
    
    const context = await getStepContext(experiment, 7);

    // 0. Data QA First
    updateLog('Auditor', 'Performing quality assurance on acquisition node...');
    const qaResult = await runDataQA(csvData, context);
    if (!qaResult.is_valid || qaResult.quality_score < 0.4) {
        updateLog('Auditor', `DATA QUALITY FAILURE: ${qaResult.issues.join('; ')}`);
        throw new Error(`DATA_QUALITY_FAILURE: ${qaResult.recommendation || "The dataset is unsuitable for analysis."}`);
    }
    updateLog('Auditor', `Data integrity verified (Quality Score: ${qaResult.quality_score}).`);

    // 1. Data Profiler
    updateLog('Profiler', 'Scanning dataset structure and quality...');
    const profilerPrompt = `
    Analyze this dataset to identify its structure, variables, and potential anomalies.
    
    DATASET (First 5000 chars):
    ${csvData.substring(0, 5000)}
    
    RESEARCH CONTEXT:
    - Question: ${context.question}
    - Hypothesis: ${context.hypothesis}
    `;
    
    const profileRes = await callGeminiWithRetry('gemini-3-flash-preview', { contents: profilerPrompt });
    updateLog('Profiler', 'Data profile generated.');

    // 2. Statistician & Visualizer
    updateLog('Analyst', 'Executing statistical tests and generating high-fidelity visualizations...');
    const analysisPrompt = `
    ACT AS: Senior Data Scientist.
    TASK: Perform a rigorous statistical analysis on the provided dataset to test the hypothesis.
    
    DATA PROFILE: ${safeGetText(profileRes)}
    RAW DATA: ${csvData}
    HYPOTHESIS TO TEST: ${context.hypothesis}
    
    REQUIREMENTS:
    1. Perform appropriate statistical tests (ANOVA, t-test, Regression) directly addressing the hypotheses: ${context.hypothesis}.
    2. Generate a detailed Markdown summary of the results, explicitly stating whether the data supports or refutes each of the hypotheses.
    3. Generate AT LEAST ONE (1) distinct table summarizing key metrics.
       - The table MUST follow the schema: {"title": "...", "headers": ["Col1", "Col2"], "rows": [["Val1", "Val2"], ...]}.
    4. Generate AT LEAST TWO (2) distinct Chart.js configuration objects (as JSON strings) that visualize the data in a way that clearly demonstrates the support or refutation of the hypotheses.
       - For Scatter charts, ensure data is [{"x": 1, "y": 2}, ...].
    
    ${feedback ? `PREVIOUS ATTEMPT FAILED WITH ERROR: ${feedback}. PLEASE CORRECT THE JSON CONFIGURATION.` : ''}
    
    CRITICAL: Output MUST be valid JSON matching the schema.
    `;
    
    const analysisRes = await callGeminiWithRetry('gemini-3-flash-preview', { 
        contents: analysisPrompt,
        config: { 
            responseMimeType: "application/json", 
            responseSchema: DATA_ANALYSIS_IMAGE_OUTPUT_SCHEMA
        }
    });
    
    let resultJson = extractJson(safeGetText(analysisRes));
    
    try {
        const parsed = JSON.parse(resultJson);
        if (parsed.charts && Array.isArray(parsed.charts)) {
            parsed.charts = parsed.charts.map((c: any) => {
                const config = typeof c.chartConfig === 'string' ? JSON.parse(c.chartConfig) : c.chartConfig;
                const styledConfig = ensureChartStyling(config);
                return { ...c, chartConfig: JSON.stringify(styledConfig) };
            });
            resultJson = JSON.stringify(parsed);
        }
        updateLog('Visualizer', 'Visual assets synthesized.');
    } catch (e) {
        console.error("Analysis post-processing error:", e);
    }

    const blockerPrompt = `Analyze the results for any scientific integrity blockers.
    RESULTS: ${resultJson}
    Output JSON: { "BLOCKER_ALERT": [ { "severity": "critical"|"warning", "msg": "..." } ] } or empty.`;
    
    const blockerRes = await callGeminiWithRetry('gemini-3-flash-preview', { contents: blockerPrompt });
    const blockers = parseBlockers(safeGetText(blockerRes));

    return { finalOutput: resultJson, blockers, logSummary: safeGetText(profileRes) };
};

export const runInterpretationAgent = async ({ experiment, updateLog }: { experiment: Experiment, updateLog: (agent: string, msg: string) => void }) => {
    updateLog('Manager', 'Initiating Interpretation Node...');
    const context = await getStepContext(experiment, 8);

    updateLog('Philosopher', 'Cross-referencing hypothesis with statistical evidence...');
    const analysisPrompt = `
    ACT AS: Principal Investigator.
    TASK: Evaluate the robustness of the experimental findings.
    
    HYPOTHESIS: ${context.hypothesis}
    ANALYSIS SUMMARY: ${context.analysis_summary}
    FIELD: ${experiment.field}
 
    Discuss:
    1. Does the evidence reject the null hypothesis?
    2. Threats to internal and external validity.
    3. Specific recommendations for follow-up research.
    
    Output a rigorous Markdown report.
    `;
    
    const res = await callGeminiWithRetry('gemini-3-flash-preview', { contents: analysisPrompt });

    updateLog('Auditor', 'Checking for over-claiming or logical leaps...');
    const blockerPrompt = `Analyze this conclusion for over-claiming.
    CONCLUSION: ${safeGetText(res)}
    Output JSON: { "BLOCKER_ALERT": [ { "severity": "critical"|"warning", "msg": "..." } ] } or empty.`;
    
    const blockerRes = await callGeminiWithRetry('gemini-3-flash-preview', { contents: blockerPrompt });
    const blockers = parseBlockers(safeGetText(blockerRes));

    return { finalOutput: safeGetText(res), blockers };
};

export const runPublicationAgent = async ({ experiment, updateLog }: { experiment: Experiment, updateLog: (agent: string, msg: string) => void }) => {
    updateLog('Manager', 'Compiling project dossier...');
    const context = await getStepContext(experiment, 10);
    
    updateLog('Writer', 'Drafting manuscript structure...');
    const outlinePrompt = `Create an outline for a scientific paper: ${context.full_project_summary_log}`;
    const outlineRes = await callGeminiWithRetry('gemini-3-flash-preview', { contents: outlinePrompt });
    
    updateLog('Writer', 'Writing full content...');
    const fullDraftPrompt = `ACT AS: Academic Author. Write the paper based on: ${safeGetText(outlineRes)} and ${context.full_project_summary_log}.
    
    REFERENCES TO USE (FOR CITATIONS):
    ${JSON.stringify(context.references)}

    CRITICAL REQUIREMENTS:
    1. FORMULAS: Display all mathematical and chemical formulas in a standard, human-friendly format (e.g., H~2~O, E = mc^2^). Use ~subscript~ and ^superscript^ notation for clarity. DO NOT use raw LaTeX unless it's a complex equation that requires it, and even then, ensure it's rendered clearly using standard typography.
    2. ABBREVIATIONS: Spell out all abbreviations on their first occurrence, followed by the abbreviation in parentheses (e.g., "Mars Technology Institute (MTI)"). This applies to all technical terms and organizations.
    3. CITATIONS & REFERENCES: 
       - Use the "REFERENCES TO USE" provided above.
       - Place citations (e.g., [1], [2]) correctly within the text where the evidence is discussed.
       - Ensure citations are ordered numerically based on their first appearance in the document.
       - List all cited references in a "References" section at the end, formatted in a standard academic style (e.g., APA or Nature style).
    4. DATA PROVENANCE: In the Methods and Discussion sections, you MUST explicitly discuss the nature of the data collection (e.g., "AI-simulated data", "synthetic dataset", or "manual entry"). Discuss the strengths and limitations of this approach (e.g., lack of physical confirmation, reliance on theoretical models).
    `;
    
    const draftRes = await callGeminiWithRetry('gemini-3-flash-preview', { contents: fullDraftPrompt });
    updateLog('Editor', 'Polishing...');
    
    return safeGetText(draftRes);
};

export const runLiteratureReviewAgent = async ({ experiment, updateLog }: { experiment: Experiment, updateLog: (agent: string, msg: string) => void }) => {
    updateLog('Librarian', 'Formulating search queries and scanning global indices...');
    const context = await getStepContext(experiment, 2);
    
    const searchPrompt = `
    ACT AS: Scientific Librarian.
    TASK: Conduct a comprehensive literature search for the following research question.
    
    RESEARCH QUESTION: ${context.question}
    
    INSTRUCTIONS:
    1. Use googleSearch to find at least 5 seminal or highly relevant peer-reviewed papers.
    2. Provide a brief summary of each paper's key findings and relevance.
    3. Ensure you capture the full titles, authors, and publication years.
    `;

    // Use gemini-3-flash-preview for search as it's optimized for grounding
    const searchRes = await callGeminiWithRetry('gemini-3-flash-preview', { 
        contents: searchPrompt, 
        config: { 
            tools: [{ googleSearch: {} }],
            temperature: 0 // Deterministic search behavior
        } 
    });
    
    updateLog('Analyst', 'Synthesizing evidence and mapping candidate mechanisms...');
    
    let searchContent = "";
    try {
        const text = safeGetText(searchRes);
        const grounding = searchRes.candidates?.[0]?.groundingMetadata;
        
        if (text) searchContent += `SUMMARY: ${text}\n\n`;
        
        // Only extract relevant grounding metadata to stay within token limits
        if (grounding?.groundingChunks) {
            const sources = grounding.groundingChunks
                .map((chunk: any, i: number) => {
                    if (chunk.web) return `[${i+1}] ${chunk.web.title}: ${chunk.web.uri}`;
                    return null;
                })
                .filter(Boolean)
                .join('\n');
            if (sources) searchContent += `SOURCES:\n${sources}\n\n`;
        }
        
        if (!searchContent) searchContent = "No search results found.";
    } catch (e) {
        searchContent = "Error extracting search results.";
    }

    const synthesisPrompt = `
    ACT AS: Senior Research Scientist.
    TASK: Synthesize the provided search results into a high-density, structured JSON literature review.
    
    RESEARCH QUESTION: ${context.question}
    SEARCH RESULTS: ${searchContent.substring(0, 10000)}
    
    REQUIREMENTS:
    1. Narrative: Provide a cohesive 2-3 paragraph synthesis of the current state of the field.
    2. Gaps: Identify at least 3 specific, actionable evidence gaps.
    3. Mechanisms: Propose at least 2 candidate mechanisms explaining the phenomena.
    4. References: List the 5 most relevant papers found.
    5. For each reference:
       - Assign a 'relevance_score' (0.0 to 1.0).
       - Assign a 'rating' from: ['Seminal', 'Supporting', 'Contradictory', 'Methodological'].
       - Provide a concise 'key_findings' summary.
    6. Sort references by 'relevance_score' descending.
    
    OUTPUT: Valid JSON matching the required schema.
    `;

    // Use gemini-3-flash-preview for complex synthesis and schema adherence
    // Use executeStepWorkflow for built-in self-correction
    const output = await executeStepWorkflow(
        'gemini-3-flash-preview', 
        { contents: synthesisPrompt }, 
        context, 
        true, 
        LITERATURE_REVIEW_SCHEMA
    );
    
    return output;
};

export const runPeerReviewAgent = async ({ experiment, updateLog }: { experiment: Experiment, updateLog: (agent: string, msg: string) => void }) => {
    const steps = [3, 4, 5, 7, 8];
    let critiqueLog = "";
    
    for (const step of steps) {
        updateLog('Reviewer', `Analyzing Step ${step} logic...`);
        const stepContent = experiment.stepData[step]?.output || "";
        const critiquePrompt = `Critique Step ${step} CONTENT: ${stepContent.substring(0, 5000)}`;
        const res = await callGeminiWithRetry('gemini-3-flash-preview', { contents: critiquePrompt });
        try {
            critiqueLog += `\n\nSTEP ${step} CRITIQUE:\n${safeGetText(res)}`;
        } catch (e) {
            critiqueLog += `\n\nSTEP ${step} CRITIQUE:\n[Failed to extract response]`;
        }
    }
    
    updateLog('Editor', 'Compiling report...');
    const finalReportPrompt = `Summarize: ${critiqueLog}`;
    const finalRes = await callGeminiWithRetry('gemini-3-flash-preview', { contents: finalReportPrompt });
    try {
        return safeGetText(finalRes);
    } catch (e) {
        throw new Error("Failed to extract text from Gemini response.");
    }
};