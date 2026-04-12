import React from 'react';

export default function EmptyState({ title, description, action = null, compact = false }) {
    return (
        <div className={`saas-empty-state${compact ? ' is-compact' : ''}`}>
            <strong>{title}</strong>
            {description ? <span>{description}</span> : null}
            {action}
        </div>
    );
}
