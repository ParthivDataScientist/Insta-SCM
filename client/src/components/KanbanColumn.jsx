import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useVirtualizer } from '@tanstack/react-virtual';
import ProjectKanbanCard from './ProjectKanbanCard';
import { normalizeProjectPriority } from '../utils/projectStatus';

const STAGE_ACCENT_CLASS = {
    'Design/BOM': 'saas-board-column--blue',
    Procurement: 'saas-board-column--amber',
    Production: 'saas-board-column--purple',
    'Completed/Closed': 'saas-board-column--green',
    Dispatch: 'saas-board-column--teal',
    'Event Installation': 'saas-board-column--indigo',
    Dismantle: 'saas-board-column--rose',
};

/**
 * KanbanColumn Component
 * Represents a single stage in the project workflow.
 * Handles drag and drop events for its area via dnd-kit.
 */
const KanbanColumn = ({
    stage,
    projectIds,
    projectsById,
    onProjectClick,
    isDragging = false,
    useVirtualization = false,
}) => {
    const { isOver, setNodeRef } = useDroppable({
        id: stage,
    });
    const bodyRef = React.useRef(null);
    const projects = React.useMemo(
        () => projectIds.map((id) => projectsById.get(id)).filter(Boolean),
        [projectIds, projectsById]
    );
    const urgentCount = projects.filter((project) => normalizeProjectPriority(project.priority) === 'high').length;
    const shouldVirtualize = useVirtualization && !isDragging && projects.length > 80;
    const accentClass = STAGE_ACCENT_CLASS[stage] || 'saas-board-column--neutral';
    const rowVirtualizer = useVirtualizer({
        count: projects.length,
        getScrollElement: () => bodyRef.current,
        estimateSize: () => 84,
        overscan: 6,
        enabled: shouldVirtualize,
    });

    return (
        <div ref={setNodeRef} className={`saas-board-column ${accentClass}${isOver ? ' is-over' : ''}`}>
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

            <div className="saas-board-column__body" ref={bodyRef}>
                <SortableContext items={projectIds.map((id) => `project-${id}`)} strategy={verticalListSortingStrategy}>
                    {shouldVirtualize ? (
                        <div
                            style={{
                                height: `${rowVirtualizer.getTotalSize()}px`,
                                width: '100%',
                                position: 'relative',
                            }}
                        >
                            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                const project = projects[virtualRow.index];
                                if (!project) return null;

                                return (
                                    <div
                                        key={project.id}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            transform: `translateY(${virtualRow.start}px)`,
                                        }}
                                    >
                                        <ProjectKanbanCard project={project} stage={stage} onClick={onProjectClick} />
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        projects.map((project) => (
                            <ProjectKanbanCard
                                key={project.id}
                                project={project}
                                stage={stage}
                                onClick={onProjectClick}
                            />
                        ))
                    )}
                </SortableContext>

                {projects.length === 0 && (
                    <div className={`saas-drop-placeholder${isOver ? ' is-active' : ''}`}>
                        <strong>Drop a project here</strong>
                        <span>Only the most relevant execution work should stay visible in each stage.</span>
                    </div>
                )}

                {isOver && projects.length > 0 ? <div className="saas-drop-placeholder saas-drop-placeholder--inline" /> : null}
            </div>
        </div>
    );
};

// Use memo to prevent columns from re-rendering if their specific projects didn't change
export default React.memo(KanbanColumn);
