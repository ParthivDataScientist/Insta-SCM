import React from 'react';
import { CalendarDays, MapPin, UserCircle2 } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { formatDateDisplay, formatDateRangeDisplay } from '../utils/dateUtils';
import { getProjectCode, normalizeBoardStage } from '../utils/projectStatus';

const resolvePrimaryWindow = (project) => {
    const start =
        project.dispatch_date ||
        project.allocation_start_date ||
        project.installation_start_date ||
        project.event_start_date;

    const end =
        project.dismantling_date ||
        project.allocation_end_date ||
        project.installation_end_date ||
        project.event_end_date ||
        start;

    return { start, end };
};

function ProjectKanbanCardSurface({ project, onClick, className, style, cardProps = {}, isButton = true }) {
    const { start, end } = resolvePrimaryWindow(project);
    const CardTag = isButton ? 'button' : 'article';

    return (
        <CardTag
            type={isButton ? 'button' : undefined}
            className={className}
            style={style}
            {...cardProps}
        >
            <div className="kanban-card__head">
                <div className="kanban-card__identity">
                    <div className="kanban-card__code">
                        {getProjectCode(project)}
                    </div>
                    <div className="kanban-card__title">
                        {project.project_name || 'Untitled project'}
                    </div>
                    {project.event_name ? (
                        <div className="kanban-card__event">
                            {project.event_name}
                        </div>
                    ) : null}
                </div>

                {project.area ? (
                    <div className="kanban-card__area">
                        {project.area}
                    </div>
                ) : null}
            </div>

            <div className="premium-card-meta kanban-card__meta">
                <div className="premium-card-meta__row">
                    <UserCircle2 size={12} className="kanban-card__meta-icon" />
                    <span className="premium-card-meta__label">Manager</span>
                    <strong className="kanban-card__meta-value">{project.project_manager || 'Unassigned'}</strong>
                </div>

                <div className="premium-card-meta__row">
                    <CalendarDays size={12} className="kanban-card__meta-icon" />
                    <span className="premium-card-meta__label">Schedule</span>
                    <strong className="kanban-card__meta-value">{start ? formatDateRangeDisplay(start, end) : 'Dates not set'}</strong>
                </div>

                <div className="premium-card-meta__row">
                    <MapPin size={12} className="kanban-card__meta-icon" />
                    <span className="premium-card-meta__label">Location</span>
                    <strong className="kanban-card__meta-value">{project.branch || project.venue || 'Not specified'}</strong>
                </div>
            </div>

            <div className="premium-card-foot kanban-card__foot">
                <span>{project.installation_start_date ? `Install ${formatDateDisplay(project.installation_start_date)}` : 'Planning card'}</span>
                <span>{project.updated_at ? `Updated ${formatDateDisplay(project.updated_at)}` : ''}</span>
            </div>
        </CardTag>
    );
}

function DraggableProjectKanbanCard({ project, onClick }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `project-${project.id}`,
        data: { id: project.id, stage: normalizeBoardStage(project.board_stage) }
    });

    return (
        <ProjectKanbanCardSurface
            project={project}
            onClick={onClick}
            isButton
            className={`kanban-card${isDragging ? ' is-dragging' : ''}`}
            style={{
                position: 'relative',
                width: '100%',
                zIndex: isDragging ? 9999 : 1,
                transform: CSS.Translate.toString(transform),
            }}
            cardProps={{
                ref: setNodeRef,
                ...listeners,
                ...attributes,
                onClick: () => onClick(project),
            }}
        />
    );
}

function ProjectKanbanCardOverlay({ project }) {
    return (
        <ProjectKanbanCardSurface
            project={project}
            onClick={() => {}}
            isButton={false}
            className="kanban-card is-drag-overlay"
            style={{
                position: 'relative',
                width: '300px',
                zIndex: 9999,
                transform: 'rotate(2.5deg)',
            }}
        />
    );
}

export default function ProjectKanbanCard({ project, onClick, dragOverlay = false }) {
    if (dragOverlay) {
        return <ProjectKanbanCardOverlay project={project} />;
    }

    return <DraggableProjectKanbanCard project={project} onClick={onClick} />;
}
