# Technical Appendix & Reference

Detailed environment and configuration specifications for Project Hypatia.

## 1. AI Model Mapping
Hypatia dynamically selects models based on task complexity.

| Task | Primary Model | Logic |
| :--- | :--- | :--- |
| **Question Formulation** | `gemini-3-pro-preview` | Deep reasoning, uniqueness check |
| **Literature Search** | `gemini-3-flash-preview` | High-speed grounding |
| **Data Simulation** | `gemini-3-flash-preview` | Iterative coding |
| **Peer Review** | `gemini-3-pro-preview` | Critical adversarial logic |
| **Publication Synthesis** | `gemini-3-pro-preview` | Academic tone, long context |

## 2. Global System Constants
- **Context Management**: 128k Token Limit (Internal summarization active).
- **Thinking Budget**: 8k Tokens (Step 10 publication logic).
- **Max Retry Logic**: 25 Iterations (Step 6 Debugger).
- **UI Refresh Rate**: 1.5 seconds (Streaming buffer).

## 3. Connectivity Endpoints
- **API Engine**: `https://generativelanguage.googleapis.com`
- **Port**: 443 (HTTPS)
- **CDN Dependencies**: 
    - React 18.3.1
    - Bootstrap 5.3.3
    - KaTeX 0.16.11
    - Chart.js 4.4.1
    - Marked 12.0.0

## 4. Security Policy
Hypatia is a **Client-Side-Only** application.
- **No Backend**: No database or middle-tier server exists.
- **Request Origin**: Requests originate from the user's IP directly to Google.
- **Sandboxing**: All AI-generated code runs in `Worker` threads with zero access to browser storage or `document` context.

## 5. Hardware Requirements
- **Memory**: 4GB+ RAM recommended for high-resolution chart rendering.
- **Disk**: ~1MB per project (IndexedDB).
- **Internet**: High-bandwidth required for streaming LLM responses.