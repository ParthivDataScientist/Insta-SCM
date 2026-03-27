import React from 'react';
import ProjectKanbanCard from './ProjectKanbanCard';

/**
 * KanbanColumn Component
 * Represents a single stage in the project workflow.
 * Handles drag and drop events for its area.
 */
const KanbanColumn = ({ 
    stage, 
    projects, 
    onProjectClick, 
    onDragOver, 
    onDrop 
}) => {
    return (
        <div 
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, stage)}
            style={{
                width: '300px', 
                flexShrink: 0, 
                display: 'flex', 
                flexDirection: 'column',
                background: 'var(--bg-in)', 
                borderRadius: 'var(--r-md)', 
                maxHeight: '100%',
                border: '1px solid var(--bd-l)',
                transition: 'background 0.2s ease'
            }}
        >
            {/* Column Header */}
            <div style={{
                padding: '14px 16px', 
                borderBottom: '1px solid var(--bd)',
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                background: 'var(--bg-card)', 
                borderRadius: 'var(--r-md) var(--r-md) 0 0',
                fontWeight: 600, 
                fontSize: '13px', 
                color: 'var(--tx)'
            }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {stage}
                </span>
                <span style={{
                    background: 'var(--bg-chip)', 
                    padding: '2px 8px', 
                    borderRadius: '12px',
                    fontSize: '11px', 
                    color: 'var(--tx3)',
                    fontWeight: 700
                }}>
                    {projects.length}
                </span>
            </div>
            
            {/* Column Items */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                {projects.map(p => (
                    <div key={p.id} id={`board-card-${p.id}`}>
                        <ProjectKanbanCard 
                            project={p} 
                            onClick={onProjectClick}
                        />
                    </div>
                ))}
                
                {projects.length === 0 && (
                    <div style={{ 
                        textAlign: 'center', 
                        padding: '32px 20px', 
                        color: 'var(--tx3)', 
                        fontSize: '12px', 
                        border: '2px dashed var(--bd-l)', 
                        borderRadius: 'var(--r-md)',
                        marginTop: '4px'
                    }}>
                        Drop projects here
                    </div>
                )}
            </div>
        </div>
    );
};

// Use memo to prevent columns from re-rendering if their specific projects didn't change
export default React.memo(KanbanColumn);
