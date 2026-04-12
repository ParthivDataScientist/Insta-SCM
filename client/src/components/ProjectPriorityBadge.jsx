import React from 'react';
import { formatProjectPriorityLabel, normalizeProjectPriority } from '../utils/projectStatus';

export default function ProjectPriorityBadge({ priority, size = 'md' }) {
    const normalized = normalizeProjectPriority(priority);

    return (
        <span className={`saas-badge saas-badge--priority saas-badge--priority-${normalized} saas-badge--${size}`}>
            {formatProjectPriorityLabel(normalized)}
        </span>
    );
}
