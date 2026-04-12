import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function AlertBanner({ message, action = null }) {
    if (!message) return null;

    return (
        <div className="saas-alert-banner" role="alert">
            <AlertTriangle size={16} />
            <span>{message}</span>
            {action}
        </div>
    );
}
