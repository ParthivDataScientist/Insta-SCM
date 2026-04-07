import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import ProjectKanbanCard from './ProjectKanbanCard';
import { motion } from 'framer-motion';

/**
 * KanbanColumn Component
 * Represents a single stage in the project workflow.
 * Handles drag and drop events for its area via dnd-kit.
 */
const KanbanColumn = ({ 
    stage, 
    projects, 
    onProjectClick 
}) => {
    const { isOver, setNodeRef } = useDroppable({
        id: stage,
    });

    return (
        <motion.div 
            ref={setNodeRef}
            layout
            style={{
                width: '320px', 
                flexShrink: 0, 
                display: 'flex', 
                flexDirection: 'column',
                background: isOver ? 'rgba(238, 242, 255, 0.98)' : 'linear-gradient(180deg, rgba(248, 250, 252, 0.98), rgba(241, 245, 249, 0.96))', 
                borderRadius: '24px', 
                maxHeight: '100%',
                border: isOver ? '1px solid var(--blue)' : '1px solid rgba(148, 163, 184, 0.18)',
                boxShadow: isOver ? '0 0 0 2px rgba(59, 130, 246, 0.1)' : '0 16px 40px rgba(15, 23, 42, 0.05)',
                transition: 'background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease'
            }}
        >
            {/* Column Header */}
            <div style={{
                padding: '18px 18px 16px', 
                borderBottom: '1px solid rgba(148, 163, 184, 0.14)',
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.72)', 
                backdropFilter: 'blur(12px)',
                borderRadius: '24px 24px 0 0',
                fontWeight: 700, 
                fontSize: '13px', 
                color: 'var(--tx)'
            }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {stage}
                </span>
                <span style={{
                    background: 'rgba(15, 23, 42, 0.06)', 
                    padding: '4px 10px', 
                    borderRadius: '999px',
                    fontSize: '11px', 
                    color: 'var(--tx3)',
                    fontWeight: 700
                }}>
                    {projects.length}
                </span>
            </div>
            
            {/* Column Items */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
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
                        padding: '40px 20px', 
                        color: isOver ? 'var(--blue)' : 'var(--tx3)', 
                        fontSize: '12px', 
                        border: isOver ? '1.5px dashed var(--blue)' : '1.5px dashed rgba(148, 163, 184, 0.32)', 
                        borderRadius: '18px',
                        marginTop: '4px',
                        background: isOver ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                        transition: 'all 0.2s ease'
                    }}>
                        Drop a project here
                    </div>
                )}
            </div>
        </motion.div>
    );
};

// Use memo to prevent columns from re-rendering if their specific projects didn't change
export default React.memo(KanbanColumn);
