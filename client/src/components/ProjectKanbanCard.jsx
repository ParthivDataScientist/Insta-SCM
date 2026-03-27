import React from 'react';
import { User, Calendar, MapPin, Warehouse, Truck, Clock, MessageSquare, Activity } from 'lucide-react';

export default function ProjectKanbanCard({ project, onClick }) {
    // Native drag start handler
    const handleDragStart = (e) => {
        e.dataTransfer.setData('text/plain', project.id);
        e.dataTransfer.effectAllowed = 'move';
        // Add a class for styling while dragging if needed
        setTimeout(() => e.target.classList.add('dragging'), 0);
    };

    const handleDragEnd = (e) => {
        e.target.classList.remove('dragging');
    };

    return (
        <div 
            className="kanban-card animate-card" 
            draggable="true"
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onClick={() => onClick(project)}
            style={{
                background: 'var(--bg-card)', padding: '12px', borderRadius: 'var(--r-md)',
                boxShadow: 'var(--sh)', border: '1px solid var(--bd)', marginBottom: '10px',
                cursor: 'grab', display: 'flex', flexDirection: 'column', gap: '8px',
                position: 'relative', overflow: 'hidden',
                transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease'
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--tx)' }}>
                    Proj # {project.id} | {project.project_name}
                </div>
            </div>

            {project.event_name && (
                <div style={{ fontSize: '11px', color: 'var(--tx3)', fontWeight: 500 }}>
                    {project.event_name}
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--tx2)' }}>
                    <User size={12} color="var(--tx3)" /> PM: <strong>{project.project_manager || 'Unassigned'}</strong>
                </div>
                {/* Mocking GM logic using team_type or just static if none */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--tx2)' }}>
                    <User size={12} color="var(--tx3)" /> GM: <strong>{project.team_type || 'Unassigned'}</strong>
                </div>
            </div>

            <div style={{ marginTop: '6px', borderTop: '1px solid var(--bd-l)', paddingTop: '6px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--tx3)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Event Details
                </div>
                {project.event_name && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--tx2)', marginBottom: '4px' }}>
                        <Calendar size={12} color="var(--tx3)" /> Show: <strong>{project.event_name}</strong>
                    </div>
                )}
                {project.event_start_date && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--tx2)', marginBottom: '4px' }}>
                        <Calendar size={12} color="var(--tx3)" /> Show Date: {project.event_start_date}
                    </div>
                )}
                {project.venue && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--tx2)', marginBottom: '4px' }}>
                        <MapPin size={12} color="var(--tx3)" /> Venue: {project.venue}
                    </div>
                )}
                {project.material_dispatch_date && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--tx2)', marginBottom: '4px' }}>
                        <Warehouse size={12} color="var(--tx3)" /> AWD Start: {project.material_dispatch_date}
                    </div>
                )}
                {project.installation_start_date && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--tx2)', marginBottom: '4px' }}>
                        <Truck size={12} color="var(--tx3)" /> Target Move-in: {project.installation_start_date}
                    </div>
                )}
            </div>

            {/* Card Footer: Metadata */}
            <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1.5px dashed var(--bd)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10.5px', color: 'var(--tx3)' }}>
                <Clock size={12} /> 
                {(() => {
                    let updatedStr = project.updated_at;
                    if (updatedStr && !updatedStr.includes('Z') && !updatedStr.includes('+')) {
                        updatedStr += 'Z';
                    }
                    const updated = updatedStr ? new Date(updatedStr) : new Date();
                    const diff = Math.floor((new Date() - updated) / 1000);
                    if (diff < 60) return <span>Last updated: <strong>just now</strong></span>;
                    if (diff < 3600) return <span>Last updated: <strong>{Math.floor(Math.max(0, diff) / 60)}m ago</strong></span>;
                    if (diff < 86400) return <span>Last updated: <strong>{Math.floor(Math.max(0, diff) / 3600)}h ago</strong></span>;
                    return <span>Last updated: <strong>{updated.toLocaleDateString()}</strong></span>;
                })()}
            </div>

            {/* Stage Badge mapping from the user's mock image */}
            <div style={{
                position: 'absolute', top: -10, right: -10, background: '#3b82f6', color: 'white',
                fontSize: '9px', fontWeight: 700, padding: '16px 12px 6px', borderRadius: '50%',
                width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                textAlign: 'center', lineHeight: 1.1, boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}>
                {project.board_stage || 'TBC'}
            </div>
        </div>
    );
}
