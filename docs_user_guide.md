# Operational User Manual

Project Hypatia is a high-bandwidth research orchestration platform. This manual details the operational procedures for the **Hypatia-Pro** interface.

## System Architecture
The interface is designed for **Single-Project focus**. Only one discovery arc is active at a time to ensure maximum computational priority for the active AI agents.

## Phase 1: Initiation
### Project Creation
On the landing page, enter your **Discovery Pulse**:
1. **Title**: The formal working name of the study.
2. **Observation**: The initial spark or anomalous data point that triggered the research.
3. **Field Selection**: Critical for tuning the AI's internal logic nodes (e.g., *Engineering* logic differs from *Social Science* logic).

### Authentication
Hypatia requires a **Frontier Link** (Gemini API Key). 
- Keys are kept in ephemeral local memory only.
- If the `ARCHIVE LINK LOST` warning appears, re-authenticate via the System Menu.

## Phase 2: The 10-Step Research Arc
The workflow is **Sequential and Non-Destructive**.
- **Sidebar Progression**: Tracks your project's maturity. Steps with a green checkmark are "Verified" and locked into the project's permanent context.
- **Manual Control**: Recommended for serious academic work. You trigger and approve every generation.
- **Agentic Override**: The system autonomously bridges all nodes. **Use for rapid prototyping.**

## Phase 3: Agentic Interaction
Specialized **Agent Fleets** operate at key milestones:
- **Step 6 (Simulation)**: Employs a *Coder* and a *Debugger*. They write, test, and "heal" code until data is produced.
- **Step 7 (Analysis)**: Employs a *Statistician* and a *Visualizer*. They create charts and textual interpretation simultaneously.
- **Step 10 (Publication)**: Employs an *Outline Manager*, a *Technical Writer*, and an *Editor-in-Chief*.

## Phase 4: Data Sovereignty
Hypatia uses **Local-First Architecture**.
- Data is stored in your browser's **IndexedDB**.
- **Warning**: Clearing site data or "cookies" may delete your research.
- **Best Practice**: Use the "Export JSON" feature in the Dashboard frequently to back up critical discovery logs.

## Core Commands
- **Verify Node**: Permanently saves the current step and unlocks the next archival link.
- **Regenerate**: Triggers the AI to reconsider the step with optional PI feedback.
- **Lab Notebook**: Access the persistent, free-form scratchpad (Upper Right Menu).