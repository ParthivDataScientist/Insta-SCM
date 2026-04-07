import React from 'react';
import { CalendarDays, MapPin, User } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
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
        background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96))',
        padding: '16px',
        borderRadius: '20px',
        boxShadow: isDragging 
            ? '0 20px 40px rgba(15, 23, 42, 0.15)' 
            : '0 10px 30px rgba(15, 23, 42, 0.06)',
        border: isDragging ? '1px solid var(--blue)' : '1px solid rgba(148, 163, 184, 0.18)',
        marginBottom: '12px',
        cursor: isDragging ? 'grabbing' : 'grab',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        position: 'relative',
        transition: isDragging ? 'none' : 'box-shadow 0.22s ease, border-color 0.22s ease',
    };

    return (
        <motion.button
            type="button"
            className="kanban-card"
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            onClick={() => onClick(project)}
            style={style}
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.97 }}
            layout
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', width: '100%' }}>
                <div style={{ minWidth: 0, textAlign: 'left' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--tx3)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                        {getProjectCode(project)}
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '15px', fontWeight: 700, color: 'var(--tx)', lineHeight: 1.35 }}>
                        {project.project_name || 'Untitled project'}
                    </div>
                    {project.event_name ? (
                        <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--tx2)', lineHeight: 1.4 }}>
                            {project.event_name}
                        </div>
                    ) : null}
                </div>

                {project.area ? (
                    <div
                        style={{
                            flexShrink: 0,
                            padding: '6px 10px',
                            borderRadius: '999px',
                            background: 'rgba(15, 23, 42, 0.04)',
                            color: 'var(--tx2)',
                            fontSize: '11px',
                            fontWeight: 700,
                        }}
                    >
                        {project.area}
                    </div>
                ) : null}
            </div>

            <div
                style={{
                    display: 'grid',
                    gap: '10px',
                    padding: '12px 14px',
                    borderRadius: '16px',
                    background: 'rgba(248, 250, 252, 0.96)',
                    border: '1px solid rgba(148, 163, 184, 0.12)',
                    width: '100%'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--tx)' }}>
                    <User size={14} color="var(--tx3)" />
                    <span style={{ color: 'var(--tx3)' }}>Manager</span>
                    <strong style={{ fontWeight: 700, color: 'var(--tx)' }}>{project.project_manager || 'Unassigned'}</strong>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: 'var(--tx)', textAlign: 'left' }}>
                    <CalendarDays size={14} color="var(--tx3)" style={{ marginTop: '1px' }} />
                    <div>
                        <div style={{ color: 'var(--tx3)', marginBottom: '2px' }}>Schedule</div>
                        <div style={{ fontWeight: 700 }}>{start ? formatDateRangeDisplay(start, end) : 'Dates not set'}</div>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: 'var(--tx)', textAlign: 'left' }}>
                    <MapPin size={14} color="var(--tx3)" style={{ marginTop: '1px' }} />
                    <div>
                        <div style={{ color: 'var(--tx3)', marginBottom: '2px' }}>Location</div>
                        <div style={{ fontWeight: 700 }}>
                            {project.branch || project.venue || 'Not specified'}
                        </div>
                    </div>
                </div>
            </div>

            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    paddingTop: '2px',
                    fontSize: '11px',
                    color: 'var(--tx3)',
                    width: '100%'
                }}
            >
                <span>{project.installation_start_date ? `Install ${formatDateDisplay(project.installation_start_date)}` : 'Planning card'}</span>
                <span>{project.updated_at ? `Updated ${formatDateDisplay(project.updated_at)}` : ''}</span>
            </div>
        </motion.button>
    );
}
