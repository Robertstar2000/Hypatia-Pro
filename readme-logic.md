# Project Hypatia - Application Logic Outline

This document outlines the logical flow of the Project Hypatia application in a human-readable, indented format.

---

### I. Application Initialization (`App` component)

-   **On first load:**
    -   The `App` component renders and sets an initial `isLoading` state.
    -   An asynchronous function is triggered to load all existing experiments from the browser's local database (IndexedDB via Dexie).
        -   **On success:**
            -   The retrieved experiments are sorted by creation date (newest first).
            -   The sorted array is stored in the `experiments` state.
            -   The most recent experiment is set as the `activeExperiment` to display a summary on the landing page.
        -   **On failure:**
            -   An error is logged to the console, and a "Could not load saved experiments" toast is displayed.
    -   The `isLoading` state is set to `false`, and the main UI is rendered.

---

### II. Core Application Flow (State and View Management)

-   The application's core state (experiments list, active experiment) is managed within the `App` component and provided to the entire component tree via a new **`ExperimentContext`**. This avoids "prop drilling" and centralizes state management.
-   The `App` component uses conditional rendering based on the `view` state variable to switch between the main sections:
    -   **If `view` is `'landing'':** The `LandingPage` component is rendered.
    -   **If `view` is `'dashboard'':** The `Dashboard` component is rendered.
    -   **If `view` is `'experiment'` AND an `activeExperiment` is selected:** The `ExperimentWorkspace` component is rendered.

---

### III. Component Logic Details

#### A. API Key Section (`ApiKeySection`)

-   This component provides two methods for authenticating with the Gemini API:
    -   **API Key**: The primary method where users enter their personal Google Gemini API key.
    -   **Promo Code**: A secondary method for demonstration. Entering the code `MTI` allows the application to use a session-based key.
-   **On "Unlock Hypatia" click:**
    -   It calls the `handleAuthentication` function in the `App` component with the appropriate type (`'key'` or `'promo'`).
    -   This function then validates the access method and initializes the Gemini service.
    -   **On success:** The main application UI is unlocked.
    -   **On failure:** A specific error toast is displayed.

#### B. Experiment Workspace (`ExperimentWorkspace`)

-   This is the core multi-step interface for a single experiment, consuming data from the `ExperimentContext`.
-   **Automation Mode:**
    -   After Step 1 is complete, if an `automationMode` has not been set, the `AutomationModeSelector` is displayed.
    -   The user chooses between `'manual'` or `'automated'`. This choice is saved to the experiment.
    -   If `'automated'` is chosen, the `runAutomationSequence` function is triggered, which loops through all remaining steps, calling the AI to generate, summarize, and save each one until the project is complete.
-   **Sidebar Navigation:**
    -   Loops through all 10 `WORKFLOW_STEPS`.
    -   Highlights the `activeStep`, disables future steps, and shows a checkmark for completed steps.
-   **"Generate" Button Logic:**
    -   Gathers context from previous steps using `getStepContext`. This function uses concise, AI-generated summaries of past steps instead of the full text, making the process much more efficient.
    -   Constructs the final prompt using `getPromptForStep`.
    -   Calls the Gemini API's streaming endpoint (for text) or standard endpoint (for JSON), updating the UI in real-time as the response arrives.
    -   Saves the final output to the database.
-   **"Complete Step & Continue" Button Logic:**
    -   A new, crucial step has been added for efficiency:
        1.  The application takes the final output of the step being completed.
        2.  It makes a separate, quick call to the Gemini API with a prompt to "Concisely summarize the following text...".
        3.  The resulting summary is saved to `stepData[stepId].summary` in the database.
    -   Only after the summary is saved does it increment the experiment's `currentStep`, save the experiment, and advance the user to the next step.
-   **Special Step Rendering:**
    -   **If `activeStep` is 6:** Renders the `ExperimentRunner` component.
    -   **If `activeStep` is 7:** Renders the `DataAnalysisWorkspace` component, which kicks off an agentic workflow.
    -   **If `activeStep` is 10:** Renders the `PublicationExporter` component, which also uses an agentic workflow.

#### C. AI Output Display (`GeneratedOutput`)

-   Renders AI-generated Markdown into styled HTML.
-   Provides an "Edit" button to allow users to modify and save the AI's output.
-   **Special Logic for JSON Steps (1, 2, 7):**
    -   It attempts to parse the AI's output as JSON according to a strict schema for that step.
    -   **On success,** it renders the appropriate custom component (e.g., `UniquenessMeter`, `DataAnalysisView` with charts, `ReferenceList`).
    -   **On failure,** it displays an error message and the raw text output, ensuring the user is never stuck.

#### D. Agentic Code Simulator (Step 6) (`CodeSimulator`)

-   This component manages the AI-generated code experiment.
-   **Secure Execution:** AI-generated JavaScript is executed inside a **sandboxed Web Worker**. This isolates the code from the application's UI and data, preventing security risks.
-   **Agentic Debugging Loop (`runAgenticSimulation`):**
    1.  The user clicks "Start Agentic Simulation."
    2.  The current code is sent to the Web Worker for execution.
    3.  **If the code runs successfully and calls `hypatia.finish(csv, summary)`:** The loop terminates, and the data is passed to the next step.
    4.  **If the code throws a runtime error:**
        -   The error message is captured.
        -   A **Debugger Agent** (a specialized Gemini prompt) is invoked. The prompt includes the full code, the specific error message, and the experiment's scientific context.
        -   The agent's goal is to analyze the error and provide a corrected version of the full script.
        -   The new, "fixed" code replaces the old code in the editor.
        -   The loop returns to step 2, and the process repeats.
    5.  This continues until the code succeeds or a maximum number of attempts is reached.

#### E. Agentic Data Analyzer (Step 7) (`DataAnalysisWorkspace`)

-   When this component mounts, it automatically triggers the `runDataAnalysisAgent` workflow if no output exists.
-   **Simplified Agentic Workflow (with Gemini 2.5):**
    1.  **Data Scientist Agent**: A single, powerful AI agent (`gemini-2.5-flash`) is invoked with the full project context (research question, hypothesis) and the raw CSV data.
    2.  **One-Shot Analysis**: The agent's task is to perform a comprehensive analysis, write a detailed summary in Markdown, and generate 2-3 valid Chart.js JSON configurations for visualization, all in a single response.
    3.  **Structured Output**: The AI is constrained to output a single JSON object that strictly conforms to a predefined schema, ensuring the data is immediately usable by the application.
    4.  **Fallback Mechanism**: If the AI fails to produce a valid structured response, a fallback mechanism is triggered to generate a text-only summary, ensuring the user is never blocked.
    5.  The final JSON, containing the summary and chart configurations, is saved as the step's output.

#### F. Agentic Publication Exporter (Step 10) (`PublicationExporter`)

-   When the user clicks "Generate Publication," the `runPublicationAgent` workflow is triggered.
-   **Agent Workflow:**
    1.  **System Agent:** Compiles all context from the entire project into a single log.
    2.  **Manager Agent:** Analyzes the log and creates a structural outline for a scientific paper (e.g., ["Abstract", "Introduction", "Methods", "Results"...]).
    3.  **Writer Agent:** Iterates through the outline. For each section, it writes the content, focusing on the relevant parts of the project log. For the "Results" section, it inserts simple placeholders (e.g., `[CHART_1]`) where visualizations should go.
    4.  **System Agent:** Generates a descriptive caption for each chart from Step 7. It then finds the simple placeholders in the text and replaces them with a more complex placeholder that includes the full caption (e.g., `[CHART_1:Figure 1: This chart shows...]`).
    5.  **System Agent:** Finds the structured reference data from Step 2 and formats it into a proper bibliography.
    6.  **Editor Agent:** Performs a final review of the entire document for grammar, flow, and consistency. It also adds a title.
    7.  The final, polished Markdown document is saved as the step's output. The `FinalPublicationView` component then renders this Markdown, replacing the chart placeholders with actual PNG images of the charts.

---

### IV. Implemented Improvements

This version of the application addresses several key problems from the initial prototype.

-   **1. Context Window Optimization:**
    -   **Problem:** Large prompts in late steps were inefficient and costly.
    -   **Solution:** Implemented on-the-fly summarization. Upon step completion, the AI generates a concise summary of the output, which is stored. The `getStepContext` function now uses these summaries for context, dramatically reducing token usage.

-   **2. Secure and Robust Code Execution:**
    -   **Problem:** Using `new Function()` was a potential security risk, and code errors would halt progress.
    -   **Solution:** The code simulator now executes JavaScript in a sandboxed **Web Worker**. Furthermore, an **agentic debugging loop** automatically detects, analyzes, and attempts to fix runtime errors, significantly improving the success rate of AI-generated code.

-   **3. Clear Authentication Methods:**
    -   **Problem:** A demo or trial mode was needed without requiring every user to immediately generate an API key.
    -   **Solution:** The application offers two clear authentication paths: a primary API key method and a secondary "promo code" (`MTI`) option for quick demos.

-   **4. Improved State Management:**
    -   **Problem:** "Prop drilling" made the code complex and hard to maintain.
    -   **Solution:** The application has been refactored to use React's Context API (`ExperimentContext`), simplifying components and making data flow clearer.

-   **5. Enhanced Error Handling:**
    -   **Problem:** API error messages were generic and unhelpful.
    -   **Solution:** Implemented more specific error handling (`parseGeminiError`) that provides users with actionable feedback.