import React from 'react';
import { CalendarDays, MapPin, User } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { formatDateDisplay, formatDateRangeDisplay } from '../utils/dateUtils';
import { getProjectCode } from '../utils/projectStatus';

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

export default function ProjectKanbanCard({ project, onClick }) {
    const { start, end } = resolvePrimaryWindow(project);
    
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `project-${project.id}`,
        data: { id: project.id, stage: project.board_stage || 'TBC' }
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 9999 : 1,
        opacity: isDragging ? 0.9 : 1,
        width: '100%',
        textAlign: 'left',
        padding: '14px',
        boxShadow: isDragging ? '0 12px 30px rgba(17, 24, 39, 0.12)' : 'none',
        borderColor: isDragging ? 'var(--accent)' : 'var(--bd)',
        cursor: isDragging ? 'grabbing' : 'grab',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        position: 'relative',
        transition: isDragging ? 'none' : 'border-color 0.16s ease',
    };

    return (
        <button
            type="button"
            className="kanban-card"
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            onClick={() => onClick(project)}
            style={style}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', width: '100%' }}>
                <div style={{ minWidth: 0, textAlign: 'left' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--tx3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        {getProjectCode(project)}
                    </div>
                    <div style={{ marginTop: '6px', fontSize: '15px', fontWeight: 700, color: 'var(--tx)', lineHeight: 1.35 }}>
                        {project.project_name || 'Untitled project'}
                    </div>
                    {project.event_name ? (
                        <div style={{ marginTop: '3px', fontSize: '12px', color: 'var(--tx3)', lineHeight: 1.4 }}>
                            {project.event_name}
                        </div>
                    ) : null}
                </div>

                {project.area ? (
                    <div
                        style={{
                            flexShrink: 0,
                            color: 'var(--tx3)',
                            fontSize: '12px',
                            fontWeight: 600,
                        }}
                    >
                        {project.area}
                    </div>
                ) : null}
            </div>

            <div className="premium-card-meta">
                <div className="premium-card-meta__row">
                    <User size={14} color="var(--tx3)" />
                    <span className="premium-card-meta__label">Manager</span>
                    <strong style={{ fontWeight: 600, color: 'var(--tx)' }}>{project.project_manager || 'Unassigned'}</strong>
                </div>

                <div className="premium-card-meta__row">
                    <CalendarDays size={14} color="var(--tx3)" style={{ marginTop: '1px' }} />
                    <span className="premium-card-meta__label">Schedule</span>
                    <strong style={{ fontWeight: 600, color: 'var(--tx)' }}>{start ? formatDateRangeDisplay(start, end) : 'Dates not set'}</strong>
                </div>

                <div className="premium-card-meta__row">
                    <MapPin size={14} color="var(--tx3)" style={{ marginTop: '1px' }} />
                    <span className="premium-card-meta__label">Location</span>
                    <strong style={{ fontWeight: 600, color: 'var(--tx)' }}>{project.branch || project.venue || 'Not specified'}</strong>
                </div>
            </div>

            <div className="premium-card-foot">
                <span>{project.installation_start_date ? `Install ${formatDateDisplay(project.installation_start_date)}` : 'Planning card'}</span>
                <span>{project.updated_at ? `Updated ${formatDateDisplay(project.updated_at)}` : ''}</span>
            </div>
        </button>
    );
}
