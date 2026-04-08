import React, { Suspense, lazy, useMemo, useState } from 'react';
import { Briefcase, RefreshCw, Search, X } from 'lucide-react';
import { useProjects } from '../hooks/useProjects';
import ProjectTable from '../components/ProjectTable';
import { CardSkeleton } from '../components/SkeletonLoader';
import AppShell from '../components/app/AppShell';
import KpiCard from '../components/app/KpiCard';
import { EXECUTION_BOARD_STAGES } from '../utils/projectStatus';

const ProjectBoardModal = lazy(() => import('../components/ProjectBoardModal'));

function FilterMetricCard({ label, value, detail, options, onChange }) {
    return (
        <div className="premium-kpi premium-kpi--neutral">
            <div className="premium-kpi__meta">
                <span className="premium-kpi__label">{label}</span>
                <div className="premium-kpi-select-wrap">
                    <select className="premium-kpi-select" value={value} onChange={(event) => onChange(event.target.value)}>
                        {options.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </div>
                <span className="premium-kpi__detail">{detail}</span>
            </div>
        </div>
    );
}

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
    const summary = useMemo(() => ({
        totalProjects: filteredProjects.length,
    }), [filteredProjects]);

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
                headerCenter={headerCenter}
                actions={actions}
            >
                <div className="premium-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                    <KpiCard
                        icon={Briefcase}
                        label="Total Projects"
                        value={summary.totalProjects}
                        detail="Visible after current filters"
                        tone="blue"
                        onClick={resetFilters}
                    />
                    <FilterMetricCard
                        label="Stage"
                        value={filterStatus}
                        detail="Filter the table by board stage."
                        onChange={setFilterStatus}
                        options={[
                            { value: 'All', label: 'All stages' },
                            ...EXECUTION_BOARD_STAGES.map((stage) => ({ value: stage, label: stage })),
                        ]}
                    />
                    <FilterMetricCard
                        label="Manager"
                        value={filterPM}
                        detail="Focus on one project manager."
                        onChange={setFilterPM}
                        options={uniquePMs.map((pm) => ({ value: pm, label: pm === 'All' ? 'All managers' : pm }))}
                    />
                    <FilterMetricCard
                        label="Branch"
                        value={filterBranch}
                        detail="Limit results to one branch."
                        onChange={setFilterBranch}
                        options={uniqueBranches.map((branch) => ({ value: branch, label: branch === 'All' ? 'All branches' : branch }))}
                    />
                </div>

                {error ? (
                    <div className="premium-banner">
                        {error}
                    </div>
                ) : null}

                <div className="premium-panel premium-table-scroll" style={{ minHeight: '420px' }}>
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
