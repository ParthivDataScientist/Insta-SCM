import React from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';

export default function AlertBanner({ message, action = null, type = 'error' }) {
    if (!message) return null;

    const isSuccess = type === 'success';
    const Icon = isSuccess ? CheckCircle : AlertTriangle;

    return (
        <div 
            className="saas-alert-banner" 
            role="alert" 
            style={isSuccess ? { backgroundColor: 'var(--color-success-bg, #e6f4ea)', color: 'var(--color-success, #1e8e3e)', borderColor: 'var(--color-success-border, #cce8d6)' } : {}}
        >
            <Icon size={16} />
            <span>{message}</span>
            {action}
        </div>
    );
}
