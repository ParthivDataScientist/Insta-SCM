import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, PointerSensor, closestCorners, useSensor, useSensors } from '@dnd-kit/core';
import { AlertTriangle, Layout, MapPin, RefreshCw, Search, Users, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import AppShell from '../components/app/AppShell';
import AlertBanner from '../components/AlertBanner';
import KpiCard from '../components/app/KpiCard';
import KanbanColumn from '../components/KanbanColumn';
import { BoardSkeleton } from '../components/SkeletonLoader';
import { EXECUTION_BOARD_STAGES, isWonProject, normalizeBoardStage, normalizeProjectPriority } from '../utils/projectStatus';

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
        filterPriority,
        setFilterPriority,
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
    const uniqueBranches = useMemo(
        () => ['All', ...new Set(projects.map((project) => project.branch).filter(Boolean))].sort(),
        [projects]
    );
    const uniqueManagers = useMemo(
        () => ['All', ...new Set(projects.map((project) => project.project_manager).filter(Boolean))].sort(),
        [projects]
    );
    const summary = useMemo(() => ({
        total: confirmedProjects.length,
        urgent: confirmedProjects.filter((project) => normalizeProjectPriority(project.priority) === 'high').length,
        inventory: confirmedProjects.filter((project) => normalizeBoardStage(project.board_stage) === 'Inventory').length,
        active: confirmedProjects.filter((project) => normalizeBoardStage(project.board_stage) !== 'Inventory').length,
    }), [confirmedProjects]);

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

    const handleDragEnd = ({ active, over }) => {
        if (!over) return;
        const projectId = active?.data?.current?.id;
        const nextStage = over?.id;
        if (!projectId || !nextStage || active?.data?.current?.stage === nextStage) return;
        updateBoardStage(projectId, nextStage);
    };

    const hasActiveFilters = filterStatus !== 'All' || filterBranch !== 'All' || filterPM !== 'All' || filterPriority !== 'All' || searchQuery !== '';
    const resetFilters = () => {
        setFilterStatus('All');
        setFilterBranch('All');
        setFilterPM('All');
        setFilterPriority('All');
        setSearchQuery('');
    };

    const actions = (
        <>
            {hasActiveFilters ? (
                <button type="button" className="premium-action-button" onClick={resetFilters}>
                    <X size={14} />
                    Clear filters
                </button>
            ) : null}
            <button type="button" className="premium-action-button premium-action-button--primary" onClick={loadData} disabled={loading}>
                <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                {loading ? 'Refreshing' : 'Refresh'}
            </button>
        </>
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

    const headerFilters = (
        <div className="premium-filter-group">
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

                <label className="premium-filter" style={{ minWidth: '180px' }}>
                    <AlertTriangle size={14} color="var(--tx3)" />
                    <select value={filterPriority} onChange={(event) => setFilterPriority(event.target.value)}>
                        <option value="All">All priorities</option>
                        <option value="high">High priority</option>
                        <option value="medium">Medium priority</option>
                        <option value="low">Low priority</option>
                    </select>
                </label>
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
                activeNav="stages"
                title="Stages"
                subtitle="A cleaner execution board for planning, movement, and stage control."
                headerCenter={headerCenter}
                headerFilters={headerFilters}
                actions={actions}
            >
                <div className="saas-stat-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                    <KpiCard label="Total" value={summary.total} />
                    <KpiCard label="Active" value={summary.active} />
                    <KpiCard label="Inventory" value={summary.inventory} tone="green" />
                    <KpiCard label="High" value={summary.urgent} tone="red" className="saas-kpi--alert" />
                </div>

                <AlertBanner message={error} />

                <div className="premium-panel" style={{ padding: '22px', overflow: 'hidden' }}>
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
                        <div className="saas-board">
                            {loading && projects.length === 0 ? (
                                <BoardSkeleton stages={EXECUTION_BOARD_STAGES} />
                            ) : (
                                <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
                                    {EXECUTION_BOARD_STAGES.map((stage) => (
                                        <KanbanColumn
                                            key={stage}
                                            stage={stage}
                                            projects={confirmedProjects.filter((project) => normalizeBoardStage(project.board_stage) === stage)}
                                            onProjectClick={setSelectedProject}
                                        />
                                    ))}
                                </DndContext>
                            )}
                        </div>
                    </div>
                </div>
            </AppShell>
        </>
    );
}
