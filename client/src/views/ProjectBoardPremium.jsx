import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, closestCorners, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Menu, Search, Bell } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import AppShell from '../components/app/AppShell';
import AlertBanner from '../components/AlertBanner';
import KanbanColumn from '../components/KanbanColumn';
import ProjectKanbanCard from '../components/ProjectKanbanCard';
import GlobalDateRangePicker from '../components/GlobalDateRangePicker';
import PremiumDateRangePicker from '../components/PremiumDateRangePicker';
import { BoardSkeleton } from '../components/SkeletonLoader';
import { EXECUTION_BOARD_STAGES, isWonProject, normalizeBoardStage, normalizeProjectPriority } from '../utils/projectStatus';
import '../design-premium.css';

const ProjectBoardModal = lazy(() => import('../components/ProjectBoardModal'));
const MOBILE_BOARD_QUERY = '(max-width: 720px)';

const getSortableId = (projectId) => `project-${projectId}`;
const getProjectIdFromSortable = (sortableId) => Number(String(sortableId).replace('project-', ''));

function createStageLayout(projects) {
    const base = Object.fromEntries(EXECUTION_BOARD_STAGES.map((stage) => [stage, []]));
    projects.forEach((project) => {
        const stage = normalizeBoardStage(project.board_stage);
        const targetStage = base[stage] ? stage : EXECUTION_BOARD_STAGES[0];
        base[targetStage].push(getSortableId(project.id));
    });
    return base;
}

function findContainer(layout, id) {
    if (!id) return null;
    if (Object.prototype.hasOwnProperty.call(layout, id)) return id;
    return Object.keys(layout).find((stage) => layout[stage].includes(id)) || null;
}

export default function ProjectBoardPremium() {
    const [selectedProject, setSelectedProject] = useState(null);
    const [activeDragId, setActiveDragId] = useState(null);
    const [boardLayout, setBoardLayout] = useState(() => Object.fromEntries(EXECUTION_BOARD_STAGES.map((stage) => [stage, []])));
    const [isMobileBoard, setIsMobileBoard] = useState(() => window.matchMedia(MOBILE_BOARD_QUERY).matches);
    const [activeMobileStage, setActiveMobileStage] = useState(EXECUTION_BOARD_STAGES[0]);
    const location = useLocation();
    const hasLinked = useRef(false);

    const {
        projects,
        filteredProjects,
        loading,
        error,
        updateBoardStage,
        updateProjectFull,
        searchQuery,
        setSearchQuery,
    } = useProjects();
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 6 },
        })
    );

    const confirmedProjects = useMemo(
        () => filteredProjects.filter((project) => isWonProject(project.stage)),
        [filteredProjects]
    );
    const projectsBySortableId = useMemo(
        () => new Map(confirmedProjects.map((project) => [getSortableId(project.id), project])),
        [confirmedProjects]
    );
    const activeProject = activeDragId ? projectsBySortableId.get(activeDragId) : null;
    const visibleStages = isMobileBoard ? [activeMobileStage] : EXECUTION_BOARD_STAGES;
    const highPriorityCount = useMemo(
        () => confirmedProjects.filter((project) => normalizeProjectPriority(project.priority) === 'high').length,
        [confirmedProjects]
    );

    useEffect(() => {
        const media = window.matchMedia(MOBILE_BOARD_QUERY);
        const updateView = () => setIsMobileBoard(media.matches);
        updateView();
        media.addEventListener('change', updateView);
        return () => media.removeEventListener('change', updateView);
    }, []);

    useEffect(() => {
        setBoardLayout((previousLayout) => {
            const nextLayout = createStageLayout(confirmedProjects);
            const previousIds = new Set(Object.values(previousLayout).flat());

            EXECUTION_BOARD_STAGES.forEach((stage) => {
                const validPreviousIds = (previousLayout[stage] || []).filter((id) => projectsBySortableId.has(id));
                const newIds = nextLayout[stage].filter((id) => !previousIds.has(id));
                nextLayout[stage] = [...validPreviousIds, ...newIds];
            });

            return nextLayout;
        });
    }, [confirmedProjects, projectsBySortableId]);

    useEffect(() => {
        if (!EXECUTION_BOARD_STAGES.includes(activeMobileStage)) {
            setActiveMobileStage(EXECUTION_BOARD_STAGES[0]);
        }
    }, [activeMobileStage]);

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
        setActiveDragId(active?.id || null);
    };

    const handleDragOver = ({ active, over }) => {
        if (!active?.id || !over?.id) return;

        setBoardLayout((current) => {
            const activeContainer = findContainer(current, active.id);
            const overContainer = findContainer(current, over.id);
            if (!activeContainer || !overContainer) return current;

            if (activeContainer === overContainer) {
                const currentItems = current[activeContainer];
                const oldIndex = currentItems.indexOf(active.id);
                const newIndex = currentItems.indexOf(over.id);
                if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return current;
                return {
                    ...current,
                    [activeContainer]: arrayMove(currentItems, oldIndex, newIndex),
                };
            }

            const sourceItems = current[activeContainer];
            const destinationItems = current[overContainer];
            const oldIndex = sourceItems.indexOf(active.id);
            const overIndex = destinationItems.indexOf(over.id);
            const insertIndex = overIndex >= 0 ? overIndex : destinationItems.length;
            if (oldIndex === -1) return current;

            const nextSource = sourceItems.filter((id) => id !== active.id);
            const nextDestination = [...destinationItems];
            nextDestination.splice(insertIndex, 0, active.id);

            return {
                ...current,
                [activeContainer]: nextSource,
                [overContainer]: nextDestination,
            };
        });
    };

    const handleDragCancel = () => {
        setActiveDragId(null);
    };

    const handleDragEnd = ({ active, over }) => {
        if (!active?.id) {
            setActiveDragId(null);
            return;
        }

        const project = projectsBySortableId.get(active.id);
        const projectId = project?.id || getProjectIdFromSortable(active.id);
        const initialStage = normalizeBoardStage(project?.board_stage);
        const nextStage = over?.id ? findContainer(boardLayout, over.id) : null;

        setActiveDragId(null);
        if (!nextStage || !projectId || !initialStage || initialStage === nextStage) return;
        updateBoardStage(projectId, nextStage);
    };

    const header = ({ toggleSidebar, sidebarOverlay, sidebarOpen }) => (
        <>
            {sidebarOverlay ? (
                <button
                    type="button"
                    className="design-dashboard__sidebar-rail-btn"
                    onClick={toggleSidebar}
                    title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
                    aria-expanded={sidebarOpen}
                    aria-controls="app-primary-sidebar"
                >
                    <Menu size={18} strokeWidth={2} aria-hidden />
                </button>
            ) : null}
            <header className="design-premium-header">
                <div className="design-premium-header__inner">
                    <div className="design-premium-header__brand">
                        <img src="/logo.jpg" alt="Insta-SCM Logo" className="design-premium-header__logo" />
                    </div>
                    
                    <div className="design-premium-header__search-container">
                        <label className="design-premium-search">
                            <Search size={16} className="design-premium-search__icon" aria-hidden />
                            <input
                                type="search"
                                placeholder="Search project, event, branch, or manager..."
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                            />
                        </label>
                    </div>

                    <div className="design-premium-header__filters">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(15, 23, 42, 0.02)', border: '1px solid rgba(15, 23, 42, 0.06)', borderRadius: '9999px', padding: '0 16px', height: '44px', fontSize: '13px', fontWeight: 500, marginRight: '16px' }}>
                            <span style={{ color: '#64748b' }}>Execution Pipeline</span>
                            <div style={{ width: '1px', height: '14px', background: 'rgba(15, 23, 42, 0.1)' }} />
                            <span style={{ color: '#64748b' }}>Total <strong style={{ color: '#0f172a' }}>{confirmedProjects.length}</strong></span>
                            <div style={{ width: '1px', height: '14px', background: 'rgba(15, 23, 42, 0.1)' }} />
                            <span style={{ color: '#64748b' }}>Priority <strong style={{ color: '#ef4444' }}>{highPriorityCount}</strong></span>
                        </div>

                        <div className="design-premium-filter">
                            <div className="design-premium-filter__label">Date range</div>
                            <PremiumDateRangePicker />
                        </div>
                    </div>

                    <div className="design-premium-header__actions">
                        <button
                            type="button"
                            className="design-premium-icon-btn"
                            title="Notifications"
                        >
                            <Bell size={18} />
                            <span className="design-premium-icon-btn__badge"></span>
                        </button>
                    </div>
                </div>
            </header>
        </>
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
                activeNav="stages"
                title="Stages"
                subtitle="A cleaner execution board for planning, movement, and stage control."
                header={header}
                showGlobalDate={false}
                pageClassName="stages-board-page"
                sidebarOverlay
            >
                <AlertBanner message={error} />

                <div className="stages-board-canvas">
                    <div className="stages-board-canvas__scroll">
                        {isMobileBoard ? (
                            <div className="saas-segmented saas-board-tabs">
                                {EXECUTION_BOARD_STAGES.map((stage) => (
                                    <button
                                        key={stage}
                                        type="button"
                                        className={activeMobileStage === stage ? 'is-active' : ''}
                                        onClick={() => setActiveMobileStage(stage)}
                                    >
                                        {stage}
                                    </button>
                                ))}
                            </div>
                        ) : null}

                        <div className="saas-board" style={{ paddingBottom: '8px' }}>
                            {loading && projects.length === 0 ? (
                                <BoardSkeleton stages={EXECUTION_BOARD_STAGES} />
                            ) : (
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCorners}
                                    onDragStart={handleDragStart}
                                    onDragOver={handleDragOver}
                                    onDragCancel={handleDragCancel}
                                    onDragEnd={handleDragEnd}
                                >
                                    {visibleStages.map((stage) => (
                                        <KanbanColumn
                                            key={stage}
                                            stage={stage}
                                            projectIds={boardLayout[stage] || []}
                                            projectsById={projectsBySortableId}
                                            onProjectClick={setSelectedProject}
                                            isDragging={Boolean(activeDragId)}
                                            useVirtualization={!isMobileBoard}
                                        />
                                    ))}
                                    <DragOverlay>
                                        {activeProject ? (
                                            <ProjectKanbanCard
                                                project={activeProject}
                                                stage={normalizeBoardStage(activeProject.board_stage)}
                                                isOverlay
                                            />
                                        ) : null}
                                    </DragOverlay>
                                </DndContext>
                            )}
                        </div>
                    </div>
                </div>
            </AppShell>
        </>
    );
}
