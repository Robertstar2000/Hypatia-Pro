/**
 * Parses a single line of a CSV, handling quoted fields.
 * This is a simple implementation and may not cover all edge cases of RFC 4180.
 * @param text The string to parse.
 * @returns An array of strings representing the cells.
 */
const parseCsvLine = (text: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
            if (inQuote && text[i+1] === '"') {
                // Escaped quote
                current += '"';
                i++;
            } else {
                inQuote = !inQuote;
            }
        } else if (char === ',' && !inQuote) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result.map(cell => cell.trim());
};


/**
 * Cleans and formats a raw string into a standardized CSV format.
 * - Trims whitespace from all cells.
 * - Enforces a consistent number of columns for all rows based on the header.
 * - Quotes all output fields to prevent issues with commas or other special characters.
 * @param csvString The raw CSV data as a string.
 * @returns A cleaned and standardized CSV string.
 */
export const cleanAndFormatCsv = (csvString: string): string => {
    if (!csvString || typeof csvString !== 'string') {
        return '';
    }

    const lines = csvString.trim().replace(/\r\n/g, '\n').split('\n');
    if (lines.length === 0) {
        return '';
    }
    
    // Parse all lines into a 2D array of cells
    const parsedData = lines.map(line => parseCsvLine(line));

    // Determine the number of columns from the header row
    const headerColumnCount = parsedData[0]?.length || 0;
    if (headerColumnCount === 0) {
        return ''; // Don't process empty or malformed headers
    }

    // Process and normalize all rows
    const cleanedData = parsedData.map(row => {
        // Pad rows that are too short
        while (row.length < headerColumnCount) {
            row.push('');
        }
        // Truncate rows that are too long
        if (row.length > headerColumnCount) {
            row = row.slice(0, headerColumnCount);
        }
        return row;
    });

    // Helper to quote a single cell value for CSV output
    const quoteCell = (cell: string): string => {
        const strCell = String(cell || '');
        // Escape existing quotes and wrap the whole thing in quotes
        const escapedCell = strCell.replace(/"/g, '""');
        return `"${escapedCell}"`;
    };

    // Re-serialize the cleaned data back into a CSV string
    const formattedLines = cleanedData.map(row => 
        row.map(quoteCell).join(',')
    );

    return formattedLines.join('\n');
};
