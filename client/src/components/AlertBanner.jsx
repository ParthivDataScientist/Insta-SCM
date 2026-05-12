import React from 'react';
import { AlertTriangle } from 'lucide-react';

function normalizeMessage(message) {
    if (!message) return '';
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) {
        return message
            .map((item) => {
                if (typeof item === 'string') return item;
                if (item && typeof item === 'object') {
                    const loc = Array.isArray(item.loc) ? item.loc.join(' > ') : '';
                    const msg = item.msg || JSON.stringify(item);
                    return loc ? `${loc}: ${msg}` : msg;
                }
                return String(item);
            })
            .join(' | ');
    }
    if (typeof message === 'object') {
        if (Array.isArray(message.detail)) return normalizeMessage(message.detail);
        if (typeof message.detail === 'string') return message.detail;
        if (typeof message.msg === 'string') return message.msg;
        try {
            return JSON.stringify(message);
        } catch (_) {
            return 'Something went wrong';
        }
    }
    return String(message);
}

export default function AlertBanner({ message, action = null }) {
    const text = normalizeMessage(message);
    if (!text) return null;

    return (
        <div className="saas-alert-banner" role="alert">
            <AlertTriangle size={16} />
            <span>{text}</span>
            {action}
        </div>
    );
}
