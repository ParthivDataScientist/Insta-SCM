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
                <label className="premium-filter" style={{ minWidth: '220px' }}>
                    <Layout size={14} color="var(--tx3)" />
                    <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
                        <option value="All">All stages</option>
                        {EXECUTION_BOARD_STAGES.map((stage) => (
                            <option key={stage} value={stage}>
                                {stage}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="premium-filter" style={{ minWidth: '180px' }}>
                    <MapPin size={14} color="var(--tx3)" />
                    <select value={filterBranch} onChange={(event) => setFilterBranch(event.target.value)}>
                        {uniqueBranches.map((branch) => (
                            <option key={branch} value={branch}>
                                {branch === 'All' ? 'All branches' : branch}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="premium-filter" style={{ minWidth: '180px' }}>
                    <Users size={14} color="var(--tx3)" />
                    <select value={filterPM} onChange={(event) => setFilterPM(event.target.value)}>
                        {uniqueManagers.map((manager) => (
                            <option key={manager} value={manager}>
                                {manager === 'All' ? 'All managers' : manager}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <div style={{ color: 'var(--tx3)', fontSize: '12px', fontWeight: 600 }}>
                Clean execution view with drag-and-drop stage planning.
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
                subtitle="A cleaner execution board for planning, movement, and manager context."
                headerCenter={headerCenter}
                actions={actions}
                toolbar={toolbar}
            >
                {error ? (
                    <div className="premium-panel" style={{ padding: '16px 18px', color: 'var(--red)' }}>
                        {error}
                    </div>
                ) : null}

                <div className="premium-panel" style={{ padding: '22px', overflow: 'hidden', background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.95))' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
                        <div style={{ width: '38px', height: '38px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '14px', background: 'rgba(37, 99, 235, 0.1)', color: 'var(--accent)' }}>
                            <Layout size={18} />
                        </div>
                        <div>
                            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--tx)' }}>Execution pipeline</div>
                            <div style={{ fontSize: '12px', color: 'var(--tx3)' }}>{confirmedProjects.length} projects in active flow across the current filters.</div>
                        </div>
                    </div>

                    <div style={{ overflowX: 'auto', paddingBottom: '8px' }}>
                        <div style={{ display: 'flex', gap: '20px', minWidth: 'max-content', alignItems: 'stretch' }}>
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
