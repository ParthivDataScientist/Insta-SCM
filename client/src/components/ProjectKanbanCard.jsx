import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getProjectCode, normalizeProjectPriority } from '../utils/projectStatus';

function formatDeadline(deadline) {
    if (!deadline) return '—';
    const parsed = new Date(deadline);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function ProjectKanbanCard({
    project,
    stage,
    onClick,
    isOverlay = false,
    style = undefined,
}) {
    const priority = normalizeProjectPriority(project?.priority);
    const sortable = useSortable({
        id: `project-${project.id}`,
        data: { type: 'project', id: project.id, stage },
        disabled: isOverlay,
    });

    const composedStyle = {
        transform: isOverlay ? undefined : CSS.Transform.toString(sortable.transform),
        transition: isOverlay ? undefined : sortable.transition,
        cursor: isOverlay ? 'grabbing' : (sortable.isDragging ? 'grabbing' : 'grab'),
        ...style,
    };

    return (
        <button
            id={`board-card-${project.id}`}
            type="button"
            className={`saas-project-card saas-project-card--${priority}${sortable.isDragging ? ' is-dragging' : ''}${isOverlay ? ' is-overlay' : ''}`}
            ref={isOverlay ? undefined : sortable.setNodeRef}
            {...(isOverlay ? {} : sortable.attributes)}
            {...(isOverlay ? {} : sortable.listeners)}
            onClick={() => {
                if (!sortable.isDragging) {
                    onClick?.(project);
                }
            }}
            style={composedStyle}
        >
            <div className="saas-project-card__mini-row">
                <div className="saas-project-card__title">{project.project_name || 'Untitled project'}</div>
                <div className="saas-project-card__code">{getProjectCode(project)}</div>
                <div className="saas-project-card__deadline">
                    Deadline: <span>{formatDeadline(project.event_start_date)}</span>
                </div>
            </div>
        </button>
    );
}

export default React.memo(ProjectKanbanCard);
