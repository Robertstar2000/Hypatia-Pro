# Project Hypatia - Application Logic Outline

This document provides a detailed, human-readable outline of the Project Hypatia application logic, highlighting the flow of data and the specific points where Large Language Model (LLM) calls occur.

---

### I. Application Initialization
1.  **State Bootstrapping**: The React application initializes, checking `localStorage` and `IndexedDB` (via Dexie) for existing research projects.
2.  **Authentication Guard**: The UI remains locked until a valid Google Gemini API key is provided or a "Promo Code" triggers the browser's AI Studio key selection dialog.
3.  **Project Loading**: If projects exist, the most recent one is loaded into the `activeExperiment` state.

---

### II. The Research Ignition (Landing Page)
1.  **Idea Capture**: User inputs a broad Title, Description, and Scientific Field.
2.  **Project Instantiation**: A new project record is created in IndexedDB with `currentStep = 1`.
3.  **LLM Call #1 (Formulation)**: 
    - **Trigger**: User clicks "Formulate Research Question".
    - **Logic**: The app sends the raw Title/Description to Gemini (`gemini-3-flash-preview`).
    - **Constraint**: Uses `RESEARCH_QUESTION_SCHEMA` (JSON Mode).
    - **Output**: Returns a refined, testable "Research Question" and a "Uniqueness Score" (0.0-1.0) with justification.

---

### III. Protocol Selection
1.  **Automation Choice**: Upon entering Step 2, the user must choose:
    - **Manual Forensic Control**: User triggers each step manually.
    - **Agentic Reconstruction (Automated)**: The app enters a recursive loop, executing steps 2 through 10 autonomously.

---

### IV. The 10-Step Scientific Workflow

#### Step 2: Literature Review (Agentic)
1.  **LLM Call #2 (Synthesis)**: 
    - **Logic**: Uses Google Search grounding. 
    - **Goal**: Identify 5+ relevant papers, summarize current knowledge, and highlight "Archive Gaps" (research opportunities).

#### Step 3: Hypothesis Formulation
1.  **Context Construction**: App gathers the Research Question and Literature Summary.
2.  **LLM Call #3 (Generation)**: Gemini generates 3 distinct, falsifiable hypotheses based on the gaps found in Step 2.

#### Step 4 & 5: Methodology and Data Plan
1.  **LLM Call #4 & #5**: Gemini drafts detailed experimental protocols and data collection tables. These are rendered as Markdown for user review.

#### Step 6: Experiment Runner (The Simulation Hub)
1.  **User Choice**: Upload CSV, Manual Entry, or Code Simulation.
2.  **Agentic Code Simulation Logic**:
    - **LLM Call #6a (The Coder)**: Gemini writes a standalone JavaScript simulation script based on the Step 4 Methodology.
    - **Execution**: The script runs in a sandboxed Web Worker.
    - **The Debugger Loop (LLM Call #6b)**: If the script fails, the error message and code are sent back to Gemini. It "heals" the code and retries (up to 25 attempts) until a valid CSV is generated.

#### Step 7: Data Analysis (Agentic)
1.  **Data Ingestion**: The CSV from Step 6 is loaded.
2.  **LLM Call #7 (The Scientist)**:
    - **Logic**: Gemini analyzes the CSV data relative to the Hypothesis.
    - **Multi-Modal Output**: Returns a Markdown summary AND Chart.js configuration objects for visual rendering.

#### Step 8: Conclusion Drawing
1.  **LLM Call #8**: Gemini evaluates if the Hypothesis (Step 3) was supported by the Analysis (Step 7), noting limitations and implications.

#### Step 9: Peer Review Simulation (Agentic)
1.  **Context Construction**: The entire project log is condensed into a single prompt.
2.  **LLM Call #9**: Gemini adopts a "Skeptical Reviewer" persona, critiquing the methodology, data integrity, and logic.

#### Step 10: Publication Draft (Agentic Writer)
1.  **The Drafting Loop (LLM Call #10)**:
    - **Phase 1 (Outlining)**: Gemini creates a formal paper structure (Abstract, Intro, Methods, Results, Discussion).
    - **Phase 2 (Drafting)**: Gemini writes each section in detail, inserting placeholders for charts from Step 7.
    - **Phase 3 (Editorial)**: A final pass for academic tone and bibliographic formatting.

---

### V. Post-Synthesis & Archival
1.  **Verification**: User clicks "Verify Node" at each step to finalize data in IndexedDB.
2.  **Exporting**: 
    - **JSON**: Full database dump for project portability.
    - **ZIP**: An archive containing the Paper (MD/PDF), Raw Data (CSV), and Visualizations (PNG).
3.  **Deployment**: Optional "Virtual Steps" (11 & 12) allow the LLM to generate a Submission Checklist or a Presentation Slide Deck based on the completed project.

---

### VI. System Utilities
- **Token Optimization**: After every major LLM generation, a secondary "Summary" call is often made to condense long outputs. This summary is used as context for future steps to prevent exceeding the model's context window.
- **Throttled Streaming**: AI text responses are buffered and updated in the UI at 1.5s intervals to maintain browser responsiveness.