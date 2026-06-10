# Engineering Specification (v3.0)

Project Hypatia Pro is a high-performance, full-stack scientific orchestration platform.

## 1. Core Technology Stack
- **Engine**: React 19 (Strict Mode enabled).
- **Styling**: Bootstrap 5.3 + Custom CSS3 Design System.
- **AI Integration**: `@google/genai` (SDK for Gemini 3.0).
- **Persistence**: Firebase Firestore (NoSQL) + Better-SQLite3 (local cache).
- **Visualization**: Chart.js 4.x + Raw Base64 Image Injection.
- **Formatting**: Marked.js + KaTeX (Formula support).
- **Backend**: Express 5.x.

## 2. Agentic Architecture (HMAP)
Hypatia utilizes a **Directed Acyclic Graph (DAG)** of agent interactions:

### 2.1 Agent Tiers
- **Logic Tier (Pro)**: `gemini-3-pro-preview` - Used for Step 1 (Reasoning), Step 9 (Adversarial Logic), and Step 10 (Technical Writing).
- **Synthesis Tier (Flash)**: `gemini-3-flash-preview` - Used for high-volume summarization and data simulation.

## 3. Security & Code Sandboxing
### Step 6 Code Execution
AI-generated JavaScript is executed in a secure, sandboxed environment.

## 4. Performance & Token Economy
- **Archival Summarization**: Upon node verification, a secondary AI call generates a concise summary (Token Compression). This summary is used for context in future steps, preventing "Context Window Bloat."
- **Throttled Streaming**: Text updates are throttled to 1500ms intervals to prevent browser rendering bottlenecks during high-token-rate streams.

## 5. Persistence Schema
```typescript
interface Experiment {
  id: string; // GUID
  title: string;
  field: string;
  currentStep: number;
  stepData: Record<number, StepData>; // Persistent Archival Nodes
  labNotebook: string;
  automationMode: 'manual' | 'automated' | null;
  createdAt: string; // ISO 8601
}
```