import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import ProjectKanbanCard from './ProjectKanbanCard';

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
        <div 
            ref={setNodeRef}
            className={`premium-column${isOver ? ' is-over' : ''}`}
        >
            <div className="premium-column__header">
                <span className="premium-column__title">{stage}</span>
                <span className="premium-column__count">{projects.length}</span>
            </div>
            
            <div className="premium-column__body">
                {projects.map(p => (
                    <div key={p.id} id={`board-card-${p.id}`}>
                        <ProjectKanbanCard 
                            project={p} 
                            onClick={onProjectClick}
                        />
                    </div>
                ))}
                
                {projects.length === 0 && (
                    <div className="premium-column__empty">
                        Drop a project here
                    </div>
                )}
            </div>
        </div>
    );
};

// Use memo to prevent columns from re-rendering if their specific projects didn't change
export default React.memo(KanbanColumn);
