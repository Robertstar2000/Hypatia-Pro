
import { 
    RESEARCH_QUESTION_SCHEMA, 
    DATA_ANALYSIS_IMAGE_OUTPUT_SCHEMA 
} from './config';
import { isValidJsonForSchema, getPromptForStep, getStepContext, getCurrentApiKey, testApiKey } from './services';
import { cleanAndFormatCsv } from './utils/csvUtils';

// --- Utilities for Testing ---
const expect = (actual: any) => ({
    toBe: (expected: any) => { 
        if (actual !== expected) throw new Error(`Expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`); 
    },
    toContain: (substring: string) => { 
        if (typeof actual !== 'string' || !actual.includes(substring)) throw new Error(`Expected "${actual}" to contain "${substring}"`); 
    },
    toEqual: (expected: any) => { 
        if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected deep equality.\nGot: ${JSON.stringify(actual)}\nExp: ${JSON.stringify(expected)}`); 
    },
    toExist: () => {
        if (actual === undefined || actual === null) throw new Error('Expected value to exist');
    }
});

const mockContext = {
    experimentField: 'Biology',
    question: 'How does caffeine affect plant growth?',
    literature_review_summary: 'Previous studies show mixed results on caffeine levels.',
    hypothesis: 'Caffeine will inhibit root development.',
    methodology_summary: 'Apply caffeine solution to Arabidopsis seedlings.',
    data_collection_plan_summary: 'Measure root length daily for 10 days.',
    experimental_data_summary: '10, 5, 2, 0 root length measurements.',
    analysis_summary: 'Strong negative correlation between caffeine and growth.',
    full_project_summary_log: 'Step 1: Question, Step 2: Lit Review, Step 3: Hypothesis...'
};

// --- Test Definitions ---
export const appTests = [
    {
        name: "[System] API Connectivity Check",
        fn: async () => {
            const key = getCurrentApiKey();
            if (!key) throw new Error("No API Key found in environment.");
            const isWorking = await testApiKey(key);
            if (!isWorking) throw new Error("Current API Key is not accepting requests. Please check settings.");
        }
    },
    {
        name: "[Unit] CSV Utility: cleanAndFormatCsv normalization",
        fn: async () => {
            const raw = "id,val\n1,10\n2";
            const expected = '"id","val"\n"1","10"\n"2",""';
            expect(cleanAndFormatCsv(raw)).toBe(expected);
        }
    },
    {
        name: "[Unit] JSON Validation: RESEARCH_QUESTION_SCHEMA validation",
        fn: async () => {
            const validJson = JSON.stringify({
                research_question: "Test?",
                study_type: "observational", // Added required field
                uniqueness_score: 0.8,
                justification: "Unique because...",
                field: "Biology"
            });
            const invalidJson = JSON.stringify({ foo: "bar" });
            
            if (!isValidJsonForSchema(validJson, RESEARCH_QUESTION_SCHEMA)) {
                 throw new Error(`Valid JSON failed validation: ${validJson}`);
            }
            if (isValidJsonForSchema(invalidJson, RESEARCH_QUESTION_SCHEMA)) {
                 throw new Error("Invalid JSON passed validation");
            }
        }
    },
    {
        name: "[Process] Step 1: Research Question Prompt logic",
        fn: async () => {
            const { basePrompt, expectJson } = getPromptForStep(1, 'Caffeine and plants', mockContext, {});
            expect(expectJson).toBe(true);
            expect(basePrompt).toContain("CRITICAL: YOU MUST OUTPUT ONLY VALID JSON");
            // Check for schema content (keys) rather than variable name
            expect(basePrompt).toContain("research_question");
            expect(basePrompt).toContain("uniqueness_score");
        }
    },
    {
        name: "[Process] Step 2: Literature Review Prompt logic",
        fn: async () => {
            const { basePrompt } = getPromptForStep(2, '', mockContext, {});
            expect(basePrompt).toContain("Literature review for:");
            expect(basePrompt).toContain(mockContext.question);
        }
    },
    {
        name: "[Process] Step 3: Hypothesis Prompt logic",
        fn: async () => {
            const { basePrompt } = getPromptForStep(3, '', mockContext, {});
            expect(basePrompt).toContain("Formulate 3 distinct hypotheses");
            expect(basePrompt).toContain(mockContext.literature_review_summary);
        }
    },
    {
        name: "[Process] Step 4: Methodology Prompt logic",
        fn: async () => {
            const { basePrompt } = getPromptForStep(4, '', mockContext, {});
            expect(basePrompt).toContain("Detailed experimental methodology for:");
            expect(basePrompt).toContain(mockContext.hypothesis);
        }
    },
    {
        name: "[Process] Step 5: Data Plan Prompt logic",
        fn: async () => {
            const { basePrompt } = getPromptForStep(5, '', mockContext, {});
            expect(basePrompt).toContain("Data collection plan for methodology:");
            expect(basePrompt).toContain(mockContext.methodology_summary);
        }
    },
    {
        name: "[Process] Step 6: Experiment Runner Prompt logic",
        fn: async () => {
            const { basePrompt } = getPromptForStep(6, '', mockContext, {});
            expect(basePrompt).toContain("Generate synthetic CSV data");
        }
    },
    {
        name: "[Logic] Experiment Runner: Context Aggregation",
        fn: async () => {
            // Verify that Step 6 (Runner) correctly inherits Hypothesis (Step 3) and Methodology (Step 4)
            // This ensures the Runner has the correct "Scientific Instructions" to generate data.
            const runnerMockExp = {
                field: 'Physics',
                stepData: {
                    3: { output: 'Hypothesis: Velocity increases with time.' },
                    4: { summary: 'Method: Drop ball from tower.' }
                }
            };
            const ctx = await getStepContext(runnerMockExp as any, 6);
            expect(ctx.hypothesis).toBe('Hypothesis: Velocity increases with time.');
            expect(ctx.methodology_summary).toBe('Method: Drop ball from tower.');
        }
    },
    {
        name: "[Logic] Experiment Runner: Data Synthesizer Prompting",
        fn: async () => {
            // Verify the specific prompt construction for the "Synthesize Data" button in the Runner
            const runnerContext = { methodology_summary: 'Mix Chemical A and B' };
            const { basePrompt } = getPromptForStep(6, '', runnerContext, {});
            expect(basePrompt).toContain("Generate synthetic CSV data");
            expect(basePrompt).toContain("Mix Chemical A and B");
        }
    },
    {
        name: "[Logic] Experiment Runner: CSV Output Sanitization",
        fn: async () => {
            // Verify that messy AI/Manual input is cleaned before moving to Analysis (Step 7)
            const messyInput = '  Time, Value \n 1,  10.5 \n 2, "20.0" ';
            const cleaned = cleanAndFormatCsv(messyInput);
            expect(cleaned).toContain('"Time","Value"');
            expect(cleaned).toContain('"1","10.5"');
            expect(cleaned).toContain('"2","20.0"');
        }
    },
    {
        name: "[Process] Step 7: Data Analysis Prompt logic",
        fn: async () => {
            const { basePrompt, expectJson } = getPromptForStep(7, 'csvData', mockContext, {});
            expect(expectJson).toBe(true);
            // Check for schema content (keys) rather than variable name
            expect(basePrompt).toContain("imageData");
            expect(basePrompt).toContain("Analyze data: csvData");
        }
    },
    {
        name: "[Process] Step 8: Conclusion Prompt logic",
        fn: async () => {
            const { basePrompt } = getPromptForStep(8, '', mockContext, {});
            expect(basePrompt).toContain("Draft conclusions from analysis summary:");
            expect(basePrompt).toContain(mockContext.analysis_summary);
        }
    },
    {
        name: "[Process] Step 9: Peer Review Prompt logic",
        fn: async () => {
            const { basePrompt } = getPromptForStep(9, '', mockContext, {});
            expect(basePrompt).toContain("Simulate a skeptical peer review");
            expect(basePrompt).toContain(mockContext.full_project_summary_log);
        }
    },
    {
        name: "[Process] Step 10: Publication Prompt logic",
        fn: async () => {
            const { basePrompt } = getPromptForStep(10, '', mockContext, {});
            expect(basePrompt).toContain("Draft a comprehensive scientific publication");
        }
    }
];
