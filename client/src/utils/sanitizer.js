import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML content to prevent XSS attacks.
 * Use this when rendering any content that could potentially contain 
 * user-generated HTML or scripts.
 * 
 * @param {string} html - The HTML string to sanitize.
 * @returns {string} - The sanitized HTML string.
 */
export function sanitize(html) {
    if (!html) return "";
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
        ALLOWED_ATTR: ['href', 'target', 'title']
    });
}

/**
 * Sanitizes a plain string by removing all HTML tags.
 * 
 * @param {string} text - The text to sanitize.
 * @returns {string} - The cleaned text.
 */
export function stripTags(text) {
    if (!text) return "";
    return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
}
