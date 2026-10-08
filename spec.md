# Project Hypatia Pro - Product Specification (v2.5)

## 1. Product Overview

**Project Hypatia Pro** is a browser-based, AI-powered scientific discovery platform. It acts as a "Digital Principal Investigator," guiding users through a rigorous, 10-step scientific method workflow—from initial ideation to a publication-ready manuscript.

### 1.1 Core Value Proposition
-   **Structured Rigor**: Enforces the standard scientific method to prevent logical leaps.
-   **Agentic Automation**: Deploys specialized AI agents to handle complex tasks like code simulation, statistical analysis, and peer review.
-   **Local Sovereignty**: A "Local-First" architecture ensuring research data remains in the user's browser (IndexedDB) until explicitly exported.
-   **Accessibility**: Democratizes high-level research capabilities using frontier LLMs (Gemini 3 series).

---

## 2. System Architecture

### 2.1 Technology Stack
-   **Frontend Framework**: React 18 (SPA).
-   **Language**: TypeScript.
-   **Styling**: Bootstrap 5.3 + Custom CSS Variables (Dark Mode "Sci-Fi" aesthetic).
-   **AI Orchestration**: Google GenAI SDK (`@google/genai`).
-   **Data Persistence**: `Dexie.js` wrapper for IndexedDB.
-   **Rendering**: `marked` (Markdown) + `KaTeX` (Math/LaTeX) + `Chart.js` (Visualization).
-   **Build Tooling**: ES Modules (via `esm.sh` for browser-native imports).

### 2.2 Data Schema (IndexedDB)
The application relies on a single relational object store: `experiments`.
```typescript
interface Experiment {
  id: string;                 // Unique GUID
  title: string;              // Project Title
  field: string;              // Scientific Field (e.g., Biology, Physics)
  currentStep: number;        // Pointer to active workflow step (1-10)
  stepData: Record<number, StepData>; // Map of step results
  fineTuneSettings: Record<number, Settings>; // Per-step AI config overrides
  labNotebook: string;        // Free-form scratchpad
  automationMode: 'manual' | 'automated' | null;
  status: 'active' | 'archived';
  studyType?: 'observational' | 'simulation' | 'benchmarking' | 'controlled_experiment' | 'qualitative';
}

interface StepData {
  input?: string;             // User or System input
  output?: string;            // Primary AI generation (Markdown/JSON)
  summary?: string;           // Compressed context for future steps
  uniquenessScore?: number;   // (Step 1 specific)
  blockers?: Array<{id: string, severity: 'critical'|'warning', msg: string}>;
}
```

---

## 3. Study Type Deep Analysis: Schemas & Validation Gates

Hypatia Pro adapts its internal logic and validation "gates" based on the selected study type. Below are the three primary research architectures.

### 3.1 Observational Study (Epidemiological/Social)
**Focus**: Identifying patterns and correlations in unmanipulated systems.

| Workflow Step | Schema Requirement | Validation Gate | Blocker Rule |
| :--- | :--- | :--- | :--- |
| **1. Question** | Must define Cohort and Exposure. | Check for causal vs. correlational language. | BLOCK if requiring active intervention. |
| **4. Protocol** | Sampling frame & Bias mitigation plan. | STROBE checklist alignment. | BLOCK if no confounder control plan. |
| **7. Analysis** | Odds Ratios, CI 95%, p-values. | Power analysis retrospective check. | BLOCK if 20%+ data points are outliers. |

*   **Loop Stop-Criteria**: Evidence map (Step 2) identifies 3+ high-quality longitudinal studies already covering the specific exposure/outcome; triggers refinement loop for new population.

### 3.2 Simulation-Based Study (Physics/Comp-Bio)
**Focus**: Testing theoretical models via computational replication.

| Workflow Step | Schema Requirement | Validation Gate | Blocker Rule |
| :--- | :--- | :--- | :--- |
| **3. Hypothesis** | Predicted mathematical relationship. | Falsifiability of model parameters. | BLOCK if model cannot be codified. |
| **6. Runner** | Code log + Seed + Library versions. | Execution watchdog (runtime check). | BLOCK if code fails to call `finish()`. |
| **7. Analysis** | Model fit (R², RMSE, residuals). | Sensitivity analysis on input noise. | BLOCK if residuals are non-random. |

*   **Loop Stop-Criteria**: Residual analysis (Step 7) shows >15% variance from predicted model; trigger Loop L3 to recalibrate simulation parameters.

### 3.3 Computational Benchmarking (AI/Algorithm Perf)
**Focus**: Comparing performance of multiple artifacts under controlled noise.

| Workflow Step | Schema Requirement | Validation Gate | Blocker Rule |
| :--- | :--- | :--- | :--- |
| **1. Question** | Baseline artifact definition. | Reproducibility of the "Benchmark Suite". | BLOCK if hardware specs are missing. |
| **4. Protocol** | Warm-up runs & Trial counts (min 5). | Control of background system noise. | BLOCK if hardware is non-homogeneous. |
| **5. Plan** | Throughput/Latency/Memory metrics. | Statistical significance of deltas. | BLOCK if baseline is not established. |

*   **Loop Stop-Criteria**: Variance across trials > 50% of the delta between benchmarks; trigger Loop L3 to stabilize environment or increase N.

---

## 4. Global "Blocker" Protocols

The AI "Principal Investigator" (PI) will halt execution if any of the following rules are triggered:

1.  **Hallucination Block**: Step 2 citations cannot be verified via Search Grounding tools.
2.  **Safety Block**: Methodology (Step 4) describes restricted biological, chemical, or cyber-warfare procedures.
3.  **Logical Contradiction Block**: Step 3 hypothesis contradicts a fundamental physical law established in Step 2 evidence without a valid theoretical pivot.
4.  **Data Quality Block**: Step 6 dataset has missing values in >30% of critical columns defined in Step 5 SAP.

---

## 5. The 10-Step Scientific Workflow (HMAP)

Each step utilizes a specific prompt strategy and model configuration.

### **Step 1: Research Question**
-   **AI Task**: Refine into a testable question. Calculate "Uniqueness Score".
-   **Validation Gate**: novelty check against search indices.

### **Step 2: Literature Review**
-   **AI Task**: Search grounding to map "Archive Gaps".
-   **Validation Gate**: Citation verification.

... [Previous Steps 3-10 definitions remain as per spec.md v2.5]
