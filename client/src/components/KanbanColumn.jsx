import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import ProjectKanbanCard from './ProjectKanbanCard';
import { motion } from 'framer-motion';
import { normalizeProjectPriority } from '../utils/projectStatus';

/**
 * KanbanColumn Component
 * Represents a single stage in the project workflow.
 * Handles drag and drop events for its area via dnd-kit.
 */
const KanbanColumn = ({
    stage,
    projects,
    onProjectClick,
}) => {
    const { isOver, setNodeRef } = useDroppable({
        id: stage,
    });
    const urgentCount = projects.filter((project) => normalizeProjectPriority(project.priority) === 'high').length;

    return (
        <motion.div
            ref={setNodeRef}
            layout
            className={`saas-board-column${isOver ? ' is-over' : ''}`}
        >
            <div className="saas-board-column__header">
                <div>
                    <div className="saas-board-column__title">{stage}</div>
                    <div className="saas-board-column__meta">
                        {urgentCount ? `${urgentCount} urgent project${urgentCount === 1 ? '' : 's'} need attention` : 'No urgent projects in this stage'}
                    </div>
                </div>
                <span className="saas-board-column__count">
                    {projects.length}
                </span>
            </div>

            <div className="saas-board-column__body">
                {projects.map(p => (
                    <div key={p.id} id={`board-card-${p.id}`}>
                        <ProjectKanbanCard
                            project={p}
                            onClick={onProjectClick}
                        />
                    </div>
                ))}

                {projects.length === 0 && (
                    <div className={`saas-drop-placeholder${isOver ? ' is-active' : ''}`}>
                        <strong>Drop a project here</strong>
                        <span>Only the most relevant execution work should stay visible in each stage.</span>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

// Use memo to prevent columns from re-rendering if their specific projects didn't change
export default React.memo(KanbanColumn);
