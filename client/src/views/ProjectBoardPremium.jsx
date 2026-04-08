import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Layout, MapPin, RefreshCw, Search, Users } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import AppShell from '../components/app/AppShell';
import KanbanColumn from '../components/KanbanColumn';
import { BoardSkeleton } from '../components/SkeletonLoader';
import { EXECUTION_BOARD_STAGES, isWonProject, normalizeBoardStage } from '../utils/projectStatus';

const ProjectBoardModal = lazy(() => import('../components/ProjectBoardModal'));

export default function ProjectBoardPremium() {
    const [selectedProject, setSelectedProject] = useState(null);
    const location = useLocation();
    const hasLinked = useRef(false);

    const {
        projects,
        filteredProjects,
        loading,
        error,
        loadData,
        updateBoardStage,
        updateProjectFull,
        filterBranch,
        setFilterBranch,
        filterPM,
        setFilterPM,
        filterStatus,
        setFilterStatus,
        searchQuery,
        setSearchQuery,
    } = useProjects();

    const confirmedProjects = useMemo(
        () => filteredProjects.filter((project) => isWonProject(project.stage)),
        [filteredProjects]
    );
    const uniqueBranches = useMemo(
        () => ['All', ...new Set(projects.map((project) => project.branch).filter(Boolean))].sort(),
        [projects]
    );
    const uniqueManagers = useMemo(
        () => ['All', ...new Set(projects.map((project) => project.project_manager).filter(Boolean))].sort(),
        [projects]
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

    const handleDragOver = (event) => {
        event.preventDefault();
    };

    const handleDrop = (event, stage) => {
        event.preventDefault();
        const projectId = Number(event.dataTransfer.getData('text/plain'));
        if (!projectId) return;
        updateBoardStage(projectId, stage);
    };

    const actions = (
        <button type="button" className="premium-action-button premium-action-button--primary" onClick={loadData} disabled={loading}>
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'Refreshing' : 'Refresh'}
        </button>
    );

    const headerCenter = (
        <label className="premium-search">
            <Search size={16} color="var(--tx3)" />
            <input
                type="search"
                placeholder="Search project, event, branch, or manager..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
            />
        </label>
    );

    const toolbar = (
            <div className="premium-filter-group" style={{ justifyContent: 'space-between', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <label className="premium-inline-filter">
                    <span className="premium-inline-filter__label">Stage</span>
                    <span className="premium-filter">
                        <Layout size={14} color="var(--tx3)" />
                        <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
                            <option value="All">All</option>
                            {EXECUTION_BOARD_STAGES.map((stage) => (
                                <option key={stage} value={stage}>
                                    {stage}
                                </option>
                            ))}
                        </select>
                    </span>
                </label>

                <label className="premium-inline-filter">
                    <span className="premium-inline-filter__label">Branch</span>
                    <span className="premium-filter">
                        <MapPin size={14} color="var(--tx3)" />
                        <select value={filterBranch} onChange={(event) => setFilterBranch(event.target.value)}>
                            {uniqueBranches.map((branch) => (
                                <option key={branch} value={branch}>
                                    {branch === 'All' ? 'All' : branch}
                                </option>
                            ))}
                        </select>
                    </span>
                </label>

                <label className="premium-inline-filter">
                    <span className="premium-inline-filter__label">Manager</span>
                    <span className="premium-filter">
                        <Users size={14} color="var(--tx3)" />
                        <select value={filterPM} onChange={(event) => setFilterPM(event.target.value)}>
                            {uniqueManagers.map((manager) => (
                                <option key={manager} value={manager}>
                                    {manager === 'All' ? 'All' : manager}
                                </option>
                            ))}
                        </select>
                    </span>
                </label>
            </div>

            <div className="premium-toolbar__meta">
                Drag projects between stages to update the live plan.
            </div>
        </div>
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
                subtitle="Live execution flow across confirmed projects."
                headerCenter={headerCenter}
                actions={actions}
                toolbar={toolbar}
            >
                {error ? (
                    <div className="premium-banner">
                        {error}
                    </div>
                ) : null}

                <div className="premium-panel premium-board-shell">
                    <div className="premium-board-shell__header">
                        <div>
                            <div className="premium-board-shell__title">Execution pipeline</div>
                            <div className="premium-board-shell__meta">{confirmedProjects.length} projects in the current view.</div>
                        </div>
                    </div>

                    <div style={{ overflowX: 'auto', paddingBottom: '8px' }}>
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
                                        onDragOver={handleDragOver}
                                        onDrop={handleDrop}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </AppShell>
        </>
    );
}
