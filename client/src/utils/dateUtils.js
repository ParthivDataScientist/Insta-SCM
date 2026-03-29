/**
 * Global Date Utilities for Insta-SCM
 * Handles formatting, parsing, and validation.
 */

/**
 * Formats an ISO date string (YYYY-MM-DD) to Display format (DD-MM-YYYY)
 */
export const formatDateDisplay = (dateStr) => {
    if (!dateStr || dateStr === '—' || dateStr === 'TBD') return dateStr;
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        
        return `${day}-${month}-${year}`;
    } catch (e) {
        return dateStr;
    }
};

/**
 * Parses a display date (DD-MM-YYYY) to ISO format (YYYY-MM-DD)
 */
export const parseDateInput = (displayStr) => {
    if (!displayStr) return null;
    
    // Check if it's already ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(displayStr)) return displayStr;
    
    // Match DD-MM-YYYY or DD/MM/YYYY
    const parts = displayStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (!parts) return null;
    
    const day = parts[1].padStart(2, '0');
    const month = parts[2].padStart(2, '0');
    const year = parts[3];
    
    return `${year}-${month}-${day}`;
};

/**
 * Validates if the string is a valid display date
 */
export const isValidDisplayDate = (str) => {
    return /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.test(str);
};

/**
 * Gets today in ISO format
 */
export const getTodayISO = () => {
    return new Date().toISOString().split('T')[0];
};
