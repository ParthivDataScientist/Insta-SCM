import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { closestCorners, DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { RefreshCw, Search } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import AppShell from '../components/app/AppShell';
import KanbanColumn from '../components/KanbanColumn';
import ProjectKanbanCard from '../components/ProjectKanbanCard';
import { BoardSkeleton } from '../components/SkeletonLoader';
import { EXECUTION_BOARD_STAGES, isWonProject, normalizeBoardStage } from '../utils/projectStatus';

const ProjectBoardModal = lazy(() => import('../components/ProjectBoardModal'));

export default function ProjectBoardPremium() {
    const [selectedProject, setSelectedProject] = useState(null);
    const [activeDragProjectId, setActiveDragProjectId] = useState(null);
    const location = useLocation();
    const hasLinked = useRef(false);
    const boardScrollRef = useRef(null);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    const {
        projects,
        filteredProjects,
        loading,
        error,
        loadData,
        updateBoardStage,
        updateProjectFull,
        searchQuery,
        setSearchQuery,
    } = useProjects();

    const confirmedProjects = useMemo(
        () => filteredProjects.filter((project) => isWonProject(project.stage)),
        [filteredProjects]
    );
    const activeDragProject = useMemo(
        () => confirmedProjects.find((project) => project.id === activeDragProjectId) || null,
        [activeDragProjectId, confirmedProjects]
    );

    useEffect(() => {
        if (hasLinked.current || confirmedProjects.length === 0) return;

        const params = new URLSearchParams(location.search);
        const projectId = Number(params.get('projectId'));
        if (!projectId) return;

        const matched = confirmedProjects.find((project) => project.id === projectId);
        if (!matched) return;

        hasLinked.current = true;
        setSelectedProject(matched);

        const timer = window.setTimeout(() => {
            const card = document.getElementById(`board-card-${projectId}`);
            card?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }, 300);

        return () => window.clearTimeout(timer);
    }, [confirmedProjects, location.search]);

    const handleDragStart = ({ active }) => {
        const projectId = active?.data?.current?.id;
        setActiveDragProjectId(projectId || null);
    };

    const clearDragState = () => {
        setActiveDragProjectId(null);
    };

    const handleDragEnd = ({ active, over }) => {
        clearDragState();
        if (!over) return;
        const projectId = active?.data?.current?.id;
        const currentStage = active?.data?.current?.stage;
        const nextStage = over?.id;
        if (!projectId || !nextStage) return;
        if (currentStage === nextStage) return;
        updateBoardStage(projectId, nextStage);
    };

    const handleBoardWheel = (event) => {
        const boardScroll = boardScrollRef.current;
        if (!boardScroll || boardScroll.scrollWidth <= boardScroll.clientWidth) {
            return;
        }

        const dominantDelta = Math.abs(event.deltaX) > 0 ? event.deltaX : event.deltaY;
        if (dominantDelta === 0) {
            return;
        }

        if (event.shiftKey || Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
            event.preventDefault();
            boardScroll.scrollLeft += dominantDelta;
        }
    };

    const actions = (
        <button type="button" className="premium-action-button premium-action-button--primary" onClick={loadData} disabled={loading}>
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'Refreshing' : 'Refresh'}
        </button>
    );

    const headerCenter = (
        <label className="premium-search design-header-search">
            <Search size={16} color="var(--tx3)" />
            <input
                type="search"
                placeholder="Search project, event, branch, or manager..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
            />
        </label>
    );

    return (
        <>
            <Suspense fallback={null}>
                {selectedProject ? (
                    <ProjectBoardModal
                        project={projects.find((project) => project.id === selectedProject.id) || selectedProject}
                        onClose={() => setSelectedProject(null)}
                        updateProjectFull={updateProjectFull}
                    />
                ) : null}
            </Suspense>

            <AppShell
                activeNav="board"
                title="Project Board"
                subtitle="Execution pipeline and live stage handoffs."
                headerCenter={headerCenter}
                actions={actions}
                pageClassName="premium-page--board"
            >
                {error ? (
                    <div className="premium-banner">
                        {error}
                    </div>
                ) : null}

                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    onDragStart={handleDragStart}
                    onDragCancel={clearDragState}
                    onDragEnd={handleDragEnd}
                >
                    <div className="premium-panel premium-board-shell">
                        <div className="premium-board-shell__header">
                            <div>
                                <div className="premium-board-shell__title">Execution pipeline</div>
                                <div className="premium-board-shell__meta">{confirmedProjects.length} projects in the current view.</div>
                            </div>
                        </div>

                        <div ref={boardScrollRef} className="premium-board-scroll" onWheel={handleBoardWheel}>
                            <div className="premium-board-columns">
                                {loading && projects.length === 0 ? (
                                    <BoardSkeleton stages={EXECUTION_BOARD_STAGES} />
                                ) : (
                                    EXECUTION_BOARD_STAGES.map((stage) => (
                                        <KanbanColumn
                                            key={stage}
                                            stage={stage}
                                            projects={confirmedProjects.filter((project) => normalizeBoardStage(project.board_stage) === stage)}
                                            onProjectClick={setSelectedProject}
                                        />
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    <DragOverlay dropAnimation={null}>
                        {activeDragProject ? (
                            <ProjectKanbanCard
                                project={activeDragProject}
                                onClick={() => {}}
                                dragOverlay
                            />
                        ) : null}
                    </DragOverlay>
                </DndContext>
            </AppShell>
        </>
    );
}
