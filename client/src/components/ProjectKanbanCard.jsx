import React from 'react';
import { CalendarDays, MapPin, User } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { formatDateDisplay, formatDateRangeDisplay } from '../utils/dateUtils';
import ProjectPriorityBadge from './ProjectPriorityBadge';
import { formatProjectStatusLabel, getProjectCode, normalizeProjectPriority } from '../utils/projectStatus';

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
    const priority = normalizeProjectPriority(project.priority);
    
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
        marginBottom: '12px',
        cursor: isDragging ? 'grabbing' : 'grab',
        position: 'relative',
    };

    return (
        <motion.button
            type="button"
            className={`saas-project-card${isDragging ? ' is-dragging' : ''} saas-priority-cell saas-priority-cell--${priority}`}
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            onClick={() => onClick(project)}
            style={style}
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.97 }}
            layout
        >
            <div className="saas-project-card__header">
                <div style={{ minWidth: 0 }}>
                    <div className="saas-eyebrow">
                        {getProjectCode(project)}
                    </div>
                    <div className="saas-project-card__title">
                        {project.project_name || 'Untitled project'}
                    </div>
                    {project.event_name ? (
                        <div className="saas-project-card__subtitle">
                            {project.event_name}
                        </div>
                    ) : null}
                </div>

                <div className="saas-inline-meta">
                    <ProjectPriorityBadge priority={priority} size="sm" />
                </div>
            </div>

            <div className="saas-inline-meta" style={{ marginTop: '14px' }}>
                <span className={`saas-badge saas-badge--status-${project.status || 'pending'} saas-badge--sm`}>
                    {formatProjectStatusLabel(project.status)}
                </span>
                {project.area ? <span className="saas-page-note">{project.area}</span> : null}
            </div>

            <div className="saas-project-card__body">
                <div className="saas-info-line">
                    <User size={14} color="var(--text-muted)" />
                    <span style={{ color: 'var(--text-muted)' }}>Manager</span>
                    <strong style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{project.project_manager || 'Unassigned'}</strong>
                </div>

                <div className="saas-info-line" style={{ alignItems: 'flex-start' }}>
                    <CalendarDays size={14} color="var(--text-muted)" style={{ marginTop: '1px' }} />
                    <div>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>Schedule</div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{start ? formatDateRangeDisplay(start, end) : 'Dates not set'}</div>
                    </div>
                </div>

                <div className="saas-info-line" style={{ alignItems: 'flex-start' }}>
                    <MapPin size={14} color="var(--text-muted)" style={{ marginTop: '1px' }} />
                    <div>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>Location</div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                            {project.branch || project.venue || 'Not specified'}
                        </div>
                    </div>
                </div>
            </div>

            <div className="saas-project-card__footer" style={{ marginTop: '14px', fontSize: '11px', color: 'var(--text-muted)' }}>
                <span>{project.installation_start_date ? `Install ${formatDateDisplay(project.installation_start_date)}` : 'Planning card'}</span>
                <span>{project.updated_at ? `Updated ${formatDateDisplay(project.updated_at)}` : ''}</span>
            </div>
        </motion.button>
    );
}
