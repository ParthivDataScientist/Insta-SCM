import React, { Suspense, lazy, useMemo, useState } from 'react';
import { Briefcase, CheckCircle2, Clock3, Layout, MapPin, RefreshCw, Search, Users, X } from 'lucide-react';
import { useProjects } from '../hooks/useProjects';
import ProjectTable from '../components/ProjectTable';
import { CardSkeleton } from '../components/SkeletonLoader';
import AppShell from '../components/app/AppShell';
import KpiCard from '../components/app/KpiCard';
import { EXECUTION_BOARD_STAGES, normalizeBoardStage } from '../utils/projectStatus';

const ProjectBoardModal = lazy(() => import('../components/ProjectBoardModal'));

export default function ProjectsDashboardPremium() {
    const [selectedProject, setSelectedProject] = useState(null);
    const [activeProjectCard, setActiveProjectCard] = useState(null);

    const {
        projects,
        filteredProjects,
        loading,
        error,
        loadData,
        filterBranch,
        setFilterBranch,
        filterPM,
        setFilterPM,
        filterStatus,
        setFilterStatus,
        searchQuery,
        setSearchQuery,
        updateProjectFull,
    } = useProjects();

    const uniqueBranches = useMemo(
        () => ['All', ...new Set(projects.map((project) => project.branch).filter(Boolean))].sort(),
        [projects]
    );

    const uniquePMs = useMemo(
        () => ['All', ...new Set(projects.map((project) => project.project_manager).filter(Boolean))].sort(),
        [projects]
    );
    const summary = useMemo(() => {
        const completedProjects = filteredProjects.filter(
            (project) => normalizeBoardStage(project.board_stage) === 'Inventory'
        );

        return {
            totalProjects: filteredProjects.length,
            completedProjects: completedProjects.length,
            activeProjects: Math.max(filteredProjects.length - completedProjects.length, 0),
        };
    }, [filteredProjects]);

    const latestActiveProject = projects.find((project) => project.id === activeProjectCard?.id) || activeProjectCard;
    const hasActiveFilters =
        filterStatus !== 'All' ||
        filterBranch !== 'All' ||
        filterPM !== 'All' ||
        searchQuery !== '' ||
        Boolean(selectedProject) ||
        Boolean(activeProjectCard);

    const resetFilters = () => {
        setFilterStatus('All');
        setFilterBranch('All');
        setFilterPM('All');
        setSearchQuery('');
        setSelectedProject(null);
        setActiveProjectCard(null);
    };

    const headerCenter = (
        <label className="premium-search">
            <Search size={16} color="var(--tx3)" />
            <input
                type="search"
                placeholder="Search project ID, project name, event, manager..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
            />
        </label>
    );

    const actions = (
        <>
            {hasActiveFilters ? (
                <button type="button" className="premium-action-button" onClick={resetFilters}>
                    <X size={14} />
                    Reset
                </button>
            ) : null}
            <button type="button" className="premium-action-button premium-action-button--primary" onClick={loadData} disabled={loading}>
                <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                {loading ? 'Syncing' : 'Refresh'}
            </button>
        </>
    );

    const toolbar = (
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
                    {uniquePMs.map((pm) => (
                        <option key={pm} value={pm}>
                            {pm === 'All' ? 'All managers' : pm}
                        </option>
                    ))}
                </select>
            </label>
        </div>
    );

    return (
        <>
            <Suspense fallback={null}>
                {latestActiveProject ? (
                    <ProjectBoardModal
                        project={latestActiveProject}
                        onClose={() => setActiveProjectCard(null)}
                        updateProjectFull={updateProjectFull}
                    />
                ) : null}
            </Suspense>

            <AppShell
                activeNav="projects"
                title="Projects"
                subtitle="Execution projects in one clean operating view."
                headerCenter={headerCenter}
                actions={actions}
                toolbar={toolbar}
            >
                <div className="premium-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                    <KpiCard
                        icon={Briefcase}
                        label="Total Projects"
                        value={summary.totalProjects}
                        detail="Visible after current filters"
                        tone="blue"
                        onClick={resetFilters}
                    />
                    <KpiCard
                        icon={Clock3}
                        label="Active"
                        value={summary.activeProjects}
                        detail="In-flight execution work"
                        tone="orange"
                    />
                    <KpiCard
                        icon={CheckCircle2}
                        label="Completed"
                        value={summary.completedProjects}
                        detail="Moved to Inventory"
                        tone="green"
                        active={filterStatus === 'Inventory'}
                        onClick={() => setFilterStatus((current) => (current === 'Inventory' ? 'All' : 'Inventory'))}
                    />
                </div>

                {error ? (
                    <div className="premium-panel" style={{ padding: '16px 18px', color: 'var(--red)' }}>
                        {error}
                    </div>
                ) : null}

                <div className="premium-panel" style={{ minHeight: '420px' }}>
                    {loading && projects.length === 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', padding: '24px' }}>
                            <CardSkeleton />
                            <CardSkeleton />
                            <CardSkeleton />
                        </div>
                    ) : (
                        <ProjectTable
                            projects={filteredProjects}
                            loading={loading}
                            selectedProject={selectedProject}
                            onSelectProject={setSelectedProject}
                            updateProjectFull={updateProjectFull}
                            onDoubleClickProject={setActiveProjectCard}
                        />
                    )}
                </div>
            </AppShell>
        </>
    );
}
