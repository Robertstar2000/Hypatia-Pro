// Local CSS/JS bundles (replacing CDN dependencies)
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.min.css';
import 'katex/dist/katex.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { ToastProvider } from './toast';
import { App } from './App';
import { ErrorBoundary } from './components/common/ErrorBoundary';

// --- RENDER APPLICATION ---
// React 19 uses the same createRoot API as 18, but we ensure the environment is consistent.
const rootElement = document.getElementById('root');

if (!rootElement) {
    throw new Error("Fatal: Root element not found in DOM.");
}

const root = ReactDOM.createRoot(rootElement);

// Note: StrictMode is disabled to prevent double-rendering during heavy AI streaming updates
root.render(
    <ErrorBoundary>
        <ToastProvider>
            <App />
        </ToastProvider>
    </ErrorBoundary>
);
