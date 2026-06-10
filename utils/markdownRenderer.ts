
import * as markedLib from 'marked';

/**
 * Optimized Markdown renderer with KaTeX support.
 * 
 * @param markdownText - The content to render.
 * @param isFinal - If false, skips expensive post-processing like KaTeX math rendering.
 */
export const renderMarkdown = (markdownText: any, isFinal: boolean = true): string => {
    if (typeof markdownText !== 'string') return '';
    if (!markdownText) return '';
    
    try {
        // Safe parsing: Resolve the correct function from the imported module object
        // The structure of 'marked' export varies between versions and environments (CJS/ESM)
        const markedModule = markedLib as any;
        const parser = markedModule.marked || markedModule.parse || markedModule.default || markedLib;
        
        let html = '';
        if (typeof parser === 'function') {
            html = parser(markdownText) as string;
        } else if (typeof parser === 'object' && typeof parser.parse === 'function') {
            html = parser.parse(markdownText) as string;
        } else {
             console.warn("Marked parser not found, using raw text fallback.");
            return `<pre style="white-space: pre-wrap;">${markdownText}</pre>`;
        }

        // Post-processing for subscripts (H~2~O) and superscripts (E=mc^2^)
        html = html.replace(/~([^~]+)~/g, '<sub>$1</sub>');
        html = html.replace(/\^([^^]+)\^/g, '<sup>$1</sup>');
        
        // Performance optimization: Skip heavy math rendering while content is still streaming
        if (!isFinal) return html;
        
        const hasMath = markdownText.includes('$') || markdownText.includes('\\(') || markdownText.includes('\\[');
        if (!hasMath) return html;

        // KaTeX post-processing for static content
        const win = window as any;
        if (win.renderMathInElement) {
            // Guard: KaTeX throws a fatal error in Quirks Mode (missing <!DOCTYPE html>)
            // We verify compatMode to prevent this crash/error log.
            if (document.compatMode === 'BackCompat') {
                console.warn("KaTeX disabled: Browser is in Quirks Mode. Ensure <!DOCTYPE html> is present.");
                return html;
            }

            const container = document.createElement('div');
            container.innerHTML = html;
            try {
                win.renderMathInElement(container, {
                    delimiters: [
                        { left: '$$', right: '$$', display: true },
                        { left: '$', right: '$', display: false },
                        { left: '\\(', right: '\\)', display: false },
                        { left: '\\[', right: '\\]', display: true }
                    ],
                    throwOnError: false,
                    trust: true,
                    strict: false,
                    // Swallow parse errors to prevent console spam
                    errorCallback: () => {}
                });
                return container.innerHTML;
            } catch (err) {
                console.error("KaTeX auto-render failed:", err);
            }
        }
        
        return html;
    } catch (error) {
        console.error("Markdown rendering failed:", error);
        return `<p class="text-danger">Forensic data reconstruction failure (Render Error).</p><pre>${markdownText.slice(0, 100)}...</pre>`;
    }
};
