
import type { Dispatch, SetStateAction } from 'react';
import { Type } from "@google/genai";

// --- TYPE DEFINITIONS ---
export type StudyType = 'observational' | 'simulation' | 'benchmarking' | 'controlled_experiment' | 'qualitative';

export interface Blocker {
    id: string;
    severity: 'critical' | 'warning';
    msg: string;
    resolved: boolean;
}

export interface AgentLogEntry {
    agent: string;
    message: string;
    timestamp: string;
}

export interface GeneratedImage {
    id: string;
    prompt: string;
    base64Data: string;
    timestamp: string;
}

export interface StepData {
    input?: string;
    suggestedInput?: string;
    output?: string;
    summary?: string;
    history?: { timestamp: string; input: string; output: string }[];
    provenance?: { timestamp: string; prompt: string; config: object, output?: string }[];
    uniquenessScore?: number;
    uniquenessJustification?: string;
    studyType?: StudyType;
    groundingMetadata?: any;
    blockers?: Blocker[];
    agentLogs?: AgentLogEntry[];
    images?: GeneratedImage[];
}

export interface FineTuneSettings {
    [key: string]: any;
}

export interface Experiment {
    id: string;
    title: string;
    description: string;
    field: string;
    currentStep: number;
    stepData: { [key: number]: StepData };
    fineTuneSettings: { [key: number]: FineTuneSettings };
    createdAt: string;
    updatedAt?: string;
    labNotebook?: string;
    automationMode: 'manual' | 'automated' | null;
    status?: 'active' | 'archived';
    studyType?: StudyType;
}

export interface ExperimentContextType {
    experiments: Experiment[];
    activeExperiment: Experiment | null;
    isAuthenticated: boolean;
    createNewExperiment: (title: string, description: string, field: string) => Promise<void>;
    updateExperiment: (updatedExperiment: Experiment) => Promise<Experiment>;
    deleteExperiment: (id: string) => Promise<void>;
    selectExperiment: (id: string) => void;
    setActiveExperiment: Dispatch<SetStateAction<Experiment | null>>;
    importExperiment: (experimentData: Experiment) => Promise<void>;
    handleAuthentication: (type: 'promo' | 'key' | 'demo', value: string) => Promise<void>;
}

export interface ToastContextType {
    addToast: (message: string, type?: 'success' | 'danger' | 'warning' | 'info') => void;
}

export const SCIENTIFIC_FIELDS = [
    "Anthropology", "Archaeology", "Astronomy", "Biochemistry", "Biology", "Chemistry",
    "Cognitive Science", "Computer Science", "Data Science", "Earth Science", "Economics",
    "Education", "Engineering", "Environmental Science", "Genetics", "Humanities",
    "Linguistics", "Materials Science", "Mathematics", "Medicine", "Neuroscience",
    "Philosophy", "Physics", "Political Science", "Psychology", "Robotics", "Social Sciences", "Sociology"
] as const;

// --- WORKFLOW CONFIGURATION ---
export const WORKFLOW_STEPS = [
    { id: 1, title: 'Research Question & Scope', icon: 'bi-question-circle', description: 'Define the research objective, target population, and object type.' },
    { id: 2, title: 'Evidence Discovery', icon: 'bi-journal-text', description: 'Grounded search of literature, prior art, and candidate mechanisms.' },
    { id: 3, title: 'Hypothesis Set', icon: 'bi-lightbulb', description: 'Convert evidence into falsifiable primary and secondary hypotheses.' },
    { id: 4, title: 'Study Design & Protocol', icon: 'bi-diagram-3', description: 'Specify the design class and replicable experimental procedures.' },
    { id: 5, title: 'Analysis Plan (SAP)', icon: 'bi-calendar-event', description: 'Lock down endpoints, preprocessing rules, and statistical tests.' },
    { id: 6, title: 'Data Acquisition', icon: 'bi-play-btn', description: 'Execute collection via upload, manual entry, or agentic simulation.' },
    { id: 7, title: 'Analysis & Visualization', icon: 'bi-graph-up', description: 'Execute the SAP and generate contract-driven visualizations.' },
    { id: 8, title: 'Interpretation & Robustness', icon: 'bi-award', description: 'Assess claims, external validity, and sensitivity to noise.' },
    { id: 9, title: 'Peer Review Simulation', icon: 'bi-people', description: 'Multi-persona adversarial audit to identify logical blockers.' },
    { id: 10, title: 'Publication Bundle', icon: 'bi-file-earmark-medical', description: 'Synthesize the reproducible manuscript and data package.' }
];

// --- AI CONFIGURATION & SCHEMAS ---

export const STEP_SPECIFIC_TUNING_PARAMETERS: { [key: number]: any[] } = {
    1: [{ name: 'strictness', label: 'Uniqueness Threshold', type: 'range', min: 0, max: 1, step: 0.1, default: 0.5, description: 'How strictly the AI should evaluate the novelty of the question.' }],
    2: [{ name: 'depth', label: 'Search Depth', type: 'select', options: ['quick', 'standard', 'deep'], default: 'standard', description: 'Depth of the archive grounding search.' }],
    3: [
        { name: 'creativity', label: 'Creativity (Temperature)', type: 'range', min: 0, max: 1, step: 0.1, default: 0.7, description: 'Controls the novelty and divergence of hypotheses.' },
        { name: 'uniqueness', label: 'Uniqueness Target', type: 'range', min: 0, max: 1, step: 0.1, default: 0.8, description: 'Target novelty score against known literature.' },
        { name: 'difficulty', label: 'Experimental Difficulty', type: 'select', options: ['Low', 'Medium', 'High', 'Blue Sky'], default: 'Medium', description: 'Complexity of the proposed validation method.' }
    ],
    9: [{ name: 'reviewerPersona', label: 'Reviewer Persona', type: 'select', options: ['Methodological Purist', 'Statistical Skeptic', 'Interdisciplinary Generalist'], default: 'Methodological Purist', description: 'The lens through which the AI critiques the work.' }]
};

export const RESEARCH_QUESTION_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        research_question: { type: Type.STRING },
        study_type: { type: Type.STRING, enum: ['observational', 'simulation', 'benchmarking', 'controlled_experiment', 'qualitative'] },
        uniqueness_score: { type: Type.NUMBER },
        justification: { type: Type.STRING },
        measurable_outcomes: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["research_question", "study_type", "uniqueness_score", "justification"]
};

export const LITERATURE_REVIEW_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        synthesis_narrative: { type: Type.STRING },
        evidence_gaps: { type: Type.ARRAY, items: { type: Type.STRING } },
        candidate_mechanisms: { type: Type.ARRAY, items: { type: Type.STRING } },
        references: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    authors: { type: Type.ARRAY, items: { type: Type.STRING } },
                    year: { type: Type.STRING },
                    journal: { type: Type.STRING },
                    key_findings: { type: Type.STRING },
                    url: { type: Type.STRING },
                    relevance_score: { type: Type.NUMBER, description: "Score from 0 to 1 indicating relevance to the research question." },
                    rating: { type: Type.STRING, enum: ['Seminal', 'Supporting', 'Contradictory', 'Methodological'], description: "The role of this paper in the review." }
                },
                required: ["title", "authors", "key_findings", "relevance_score"]
            }
        }
    },
    required: ["synthesis_narrative", "evidence_gaps", "references"]
};

// Simplified schema for charts to be robust for LLM generation
export const DATA_ANALYSIS_IMAGE_OUTPUT_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        summary: { type: Type.STRING },
        statistical_outputs: { type: Type.STRING },
        tables: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    headers: { type: Type.ARRAY, items: { type: Type.STRING } },
                    rows: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } } }
                },
                required: ["title", "headers", "rows"]
            }
        },
        charts: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    type: { type: Type.STRING, enum: ['bar', 'line', 'scatter', 'pie', 'doughnut'] },
                    // We ask for a stringified JSON config to avoid deeply nested schema validation issues with Gemini
                    chartConfig: { type: Type.STRING, description: "Valid Chart.js JSON configuration string" }
                },
                required: ["title", "type", "chartConfig"]
            }
        }
    },
    required: ["summary", "charts"]
};

export const DATA_QA_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        is_valid: { type: Type.BOOLEAN },
        quality_score: { type: Type.NUMBER },
        issues: { type: Type.ARRAY, items: { type: Type.STRING } },
        recommendation: { type: Type.STRING }
    },
    required: ["is_valid", "quality_score", "issues"]
};

export const DYNAMIC_TABLE_SCHEMA = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            columnName: { type: Type.STRING },
            dataType: { type: Type.STRING, enum: ['string', 'number', 'boolean', 'date'] },
            description: { type: Type.STRING }
        },
        required: ["columnName", "dataType"]
    }
};
