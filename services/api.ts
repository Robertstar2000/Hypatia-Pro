
import { GoogleGenAI } from "@google/genai";
import { Blocker } from '../config';

// --- API KEY MANAGEMENT ---

export const getSafeEnvApiKey = () => {
    // 1. Check localStorage (User-provided key)
    const storedKey = typeof window !== 'undefined' ? localStorage.getItem('hmap-gemini-api-key') : null;
    if (storedKey) return storedKey;

    // 2. Check environment variable (System-provided key)
    // @ts-ignore - process is polyfilled in index.html
    if (typeof process !== 'undefined' && process.env) {
        if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
        if (process.env.API_KEY) return process.env.API_KEY;
    }
    return '';
};

export const getCurrentApiKey = () => getSafeEnvApiKey();

export const getKeyStatus = () => {
    const envKey = getSafeEnvApiKey();
    if (envKey) return { type: 'env', label: 'Secure Link Active', color: 'bg-success' };
    return { type: 'none', label: 'Link Disconnected', color: 'bg-danger' };
};

export const testApiKey = async (key: string): Promise<boolean> => {
    if (!key) return false;
    try {
        const ai = new GoogleGenAI({ apiKey: key });
        await ai.models.generateContent({
             model: 'gemini-3-flash-preview',
             contents: 'Ping.',
        });
        return true;
    } catch (e) {
        return false;
    }
};

// --- ERROR HANDLING & PARSING ---

export const parseGeminiError = (error: any, defaultMsg = "An error occurred with the AI service."): string => {
    console.error("Gemini Error:", error);
    const msg = error?.message || error?.toString() || "";
    
    if (msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED")) {
        return "Quota Limit Reached. System is cooling down...";
    }
    if (msg.includes("401")) return "Authentication Failed. Please check API Key.";
    if (msg.includes("503") || msg.includes("overloaded") || msg.includes("500") || msg.includes("Rpc failed")) return "Service Temporarily Unavailable. Retrying...";
    if (msg.includes("SAFETY")) return "Safety Filter Triggered. Please refine input.";
    if (msg.includes("400") || msg.includes("Bad Request") || msg.includes("INVALID_ARGUMENT")) return `Invalid Request: ${msg}`;
    
    return defaultMsg;
};

// --- ROBUST EXECUTION ENGINE ---

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface RetryOptions {
    maxRetries?: number;
    onStatusUpdate?: (status: string) => void;
    allowFallback?: boolean;
    timeout?: number;
}

/**
 * Wraps a promise with a timeout.
 */
const callGeminiWithTimeout = async (geminiCall: Promise<any>, timeout: number = 900000) => {
    let timeoutId: any;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`API call timed out after ${timeout / 1000} seconds.`)), timeout);
    });

    try {
        const result = await Promise.race([geminiCall, timeoutPromise]);
        clearTimeout(timeoutId);
        return result;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
};

/**
 * Executes a Gemini API call with sophisticated error recovery.
 * Handles 429 (Quota) and 503 (Load) with exponential backoff and jitter.
 * Provides real-time status updates to the UI.
 */
export const callGeminiWithRetry = async (
    modelName: string, 
    params: any, 
    optionsOrRetries: number | RetryOptions = 5
) => {
    // Normalize options
    const options: RetryOptions = typeof optionsOrRetries === 'number' 
        ? { maxRetries: optionsOrRetries } 
        : optionsOrRetries;
        
    const { maxRetries = 5, onStatusUpdate, allowFallback = true, timeout = 900000 } = options;

    // Config defaults
    const defaults = { temperature: 0.7, topK: 40 };
    params.config = { ...defaults, ...(params.config || {}) };

    // Ensure model name is correct (baseline alignment)
    let currentModel = modelName;
    if (modelName === 'gemini-3.1-flash-preview' || modelName === 'gemini-3.1-pro-preview') {
        currentModel = 'gemini-3-flash-preview';
    }
    let attempts = 0;

    while (true) {
        try {
            const apiKey = getSafeEnvApiKey();
            if (!apiKey) throw new Error("No API Key available.");
        
            const ai = new GoogleGenAI({ apiKey });

            const response = await callGeminiWithTimeout(ai.models.generateContent({
                model: currentModel,
                ...params
            }), timeout);
            return response;
        } catch (error: any) {
            attempts++;
            const msg = error?.message || error?.toString() || "";
            console.error(`[API Error] Attempt ${attempts} failed for model ${currentModel}:`, error);
            
            const isQuota = msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED");
            const isOverloaded = msg.includes("503") || msg.includes("overloaded") || msg.includes("500") || msg.includes("Rpc failed");
            const isAuthError = msg.includes("401") || msg.includes("API key");
            const isTimeoutError = msg.includes("timed out");
            const isBadRequest = msg.includes("400") || msg.includes("Bad Request") || msg.includes("INVALID_ARGUMENT");

            if (isAuthError || isBadRequest) {
                console.error(`[API Fatal Error] ${isAuthError ? 'Auth' : 'Bad Request'} error:`, msg);
                throw error; // Cannot retry auth or bad request errors
            }

            // Fallback Logic
            if (attempts > maxRetries) {
                 if (allowFallback && currentModel !== 'gemini-3-flash-preview' && !modelName.includes('image')) {
                     const fallbackMsg = `Primary model (${currentModel}) unresponsive. Rerouting to Flash...`;
                     console.warn(fallbackMsg);
                     if (onStatusUpdate) onStatusUpdate(fallbackMsg);
                     
                     currentModel = 'gemini-3-flash-preview';
                     attempts = 0; // Reset attempts for the fallback model
                     await wait(2000);
                     continue;
                 }
                 console.error(`[API Exhausted] All ${attempts} attempts failed. Last error:`, msg);
                 throw error; // Exhausted all options
            }

            // Smart Backoff Calculation
            let waitTime = 1000 * Math.pow(2, attempts); // Exponential: 2s, 4s, 8s...
            
            if (isQuota) {
                // Quota errors need significantly more time + jitter to avoid thundering herd
                waitTime = 15000 + (Math.random() * 5000); // 15-20s window
                const seconds = Math.round(waitTime / 1000);
                if (onStatusUpdate) onStatusUpdate(`Quota Limit (429). Pausing for ${seconds}s to recover...`);
            } else if (isOverloaded) {
                if (onStatusUpdate) onStatusUpdate(`Model Overloaded (503). Retrying in ${Math.round(waitTime/1000)}s...`);
            } else if (isTimeoutError) {
                if (onStatusUpdate) onStatusUpdate(`API call timed out. Retrying (${attempts}/${maxRetries})...`);
            } else {
                 if (onStatusUpdate) onStatusUpdate(`Connection interrupted. Retrying (${attempts}/${maxRetries})...`);
            }

            console.log(`[API Retry] Attempt ${attempts} waiting ${waitTime}ms. Error: ${msg}`);
            await wait(waitTime);
        }
    }
};

export const callGeminiStreamWithRetry = async (
    modelName: string, 
    params: any,
    options: RetryOptions = {}
) => {
    const { maxRetries = 5, onStatusUpdate, timeout = 900000 } = options;

    let attempts = 0;
    while (true) {
        try {
            const apiKey = getSafeEnvApiKey();
            if (!apiKey) throw new Error("No API Key available.");
        
            const ai = new GoogleGenAI({ apiKey });

            const stream = await callGeminiWithTimeout(ai.models.generateContentStream({
                model: modelName,
                ...params
            }), timeout);
            return stream;
        } catch (error: any) {
            attempts++;
            const msg = error?.message || error?.toString() || "";
            const isBadRequest = msg.includes("400") || msg.includes("Bad Request") || msg.includes("INVALID_ARGUMENT");
            if (attempts > maxRetries || msg.includes("401") || isBadRequest) throw error;

            const waitTime = 2000 * attempts;
            if (onStatusUpdate) onStatusUpdate(`Stream connection failed. Retrying in ${waitTime/1000}s...`);
            await wait(waitTime);
        }
    }
};

/**
 * Generates an image using Gemini 3 Pro Image Preview.
 * Used for visualizing lab setups and data concepts.
 */
export const generateLabImage = async (prompt: string): Promise<string | null> => {
    const apiKey = getSafeEnvApiKey();
    if (!apiKey) throw new Error("No API Key available.");
    const ai = new GoogleGenAI({ apiKey });

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-image-preview',
            contents: {
                parts: [{ text: prompt }]
            },
            config: {
                imageConfig: {
                    aspectRatio: "16:9",
                    imageSize: "1K"
                }
            }
        });

        // Find image part in response
        const candidates = response.candidates;
        if (candidates && candidates.length > 0) {
             const content = candidates[0].content;
             if (content && content.parts) {
                 for (const part of content.parts) {
                     if (part.inlineData && part.inlineData.mimeType.startsWith('image')) {
                         return part.inlineData.data;
                     }
                 }
             }
        }
        return null;
    } catch (e) {
        console.error("Image generation failed", e);
        throw e;
    }
};

// --- UTILITIES ---

export const extractJson = (text: any): string => {
    if (typeof text !== 'string' || !text) return "";
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (match && match[1]) return match[1].trim();
    
    // If no markdown blocks, find the first '{' or '[' and last '}' or ']'
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');
    
    let firstIndex = -1;
    let lastIndex = -1;

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        firstIndex = firstBrace;
        lastIndex = lastBrace;
    } else if (firstBracket !== -1) {
        firstIndex = firstBracket;
        lastIndex = lastBracket;
    }

    if (firstIndex !== -1 && lastIndex !== -1 && lastIndex > firstIndex) {
        return text.substring(firstIndex, lastIndex + 1).trim();
    }
    
    return text.trim();
};

export const isValidJsonForSchema = (jsonString: string, schema: any): boolean => {
    try {
        const obj = JSON.parse(jsonString);
        return !!obj;
    } catch (e) {
        return false;
    }
};

export const safeGetText = (response: any): string => {
    try {
        return response.text || "";
    } catch (e) {
        console.error("Failed to extract text from response:", e);
        return "";
    }
};

export const parseBlockers = (text: string): Blocker[] => {
    try {
        const jsonStr = extractJson(text);
        if (!jsonStr) return [];
        const data = JSON.parse(jsonStr);
        const alert = data.BLOCKER_ALERT || (data.severity ? data : null);
        if (!alert) return [];

        const list = Array.isArray(alert) ? alert : [alert];
        return list.map((b: any, i: number) => ({
            id: `blk_${Date.now()}_${i}`,
            severity: b.severity,
            msg: b.msg,
            resolved: false
        }));
    } catch (e) {
        return [];
    }
};

export const generateNodeSummary = async (content: string, field: string): Promise<string> => {
    if (!content || content.length < 50) return content;
    const prompt = `As a Research Archivist in ${field}, compress the following content into a concise, high-density summary (max 3 sentences). Preserve key variables and findings.\n\nCONTENT:\n${content.substring(0, 15000)}...`;
    try {
        const response = await callGeminiWithRetry('gemini-3-flash-preview', { contents: prompt });
        return safeGetText(response) || content.substring(0, 200) + "...";
    } catch (e) {
        return content.substring(0, 200) + "...";
    }
};
