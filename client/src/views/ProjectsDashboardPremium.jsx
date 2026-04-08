import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Briefcase, ChevronDown, Layout, MapPin, RefreshCw, Search, UserCircle2, X } from 'lucide-react';
import { useProjects } from '../hooks/useProjects';
import ProjectTable from '../components/ProjectTable';
import { CardSkeleton } from '../components/SkeletonLoader';
import AppShell from '../components/app/AppShell';
import KpiCard from '../components/app/KpiCard';
import { EXECUTION_BOARD_STAGES, normalizeBoardStage } from '../utils/projectStatus';

const ProjectBoardModal = lazy(() => import('../components/ProjectBoardModal'));

function buildCountMap(items, values, readValue) {
    return values.map((value) => ({
        value,
        label: value,
        count: items.filter((item) => readValue(item) === value).length,
    }));
}

function DropdownKpiCard({
    icon: Icon,
    label,
    selectedValue,
    options,
    totalCount,
    active,
    open,
    onToggle,
    onSelect,
    totalDetail = null,
    selectedDetail = null,
    tone = 'neutral',
}) {
    const rootRef = useRef(null);
    const selectedOption = options.find((option) => option.value === selectedValue) || options[0];
    const displayCount = totalCount;
    const detail = selectedValue === 'All' ? (totalDetail || `Total ${label.toLowerCase()}`) : (selectedDetail || selectedOption?.label);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handlePointerDown = (event) => {
            if (rootRef.current && !rootRef.current.contains(event.target)) {
                onToggle(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [open, onToggle]);

    return (
        <div ref={rootRef} className="premium-kpi-dropdown-card">
            <button
                type="button"
                className={`premium-kpi premium-kpi--${tone} premium-kpi--dropdown${active ? ' is-active' : ''}${open ? ' is-open' : ''}`}
                onClick={() => onToggle(!open)}
                aria-expanded={open}
            >
                <div className="premium-kpi__meta">
                    <span className="premium-kpi__label">{label}</span>
                    <strong className="premium-kpi__value">{displayCount}</strong>
                    <span className="premium-kpi__detail">{detail}</span>
                </div>
                <span className="premium-kpi__icon">
                    <Icon size={18} />
                </span>
                <span className="premium-kpi__chevron">
                    <ChevronDown size={16} />
                </span>
            </button>

            {open ? (
                <div className="premium-kpi-dropdown-menu" role="menu" aria-label={`${label} filters`}>
                    {options.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            className={`premium-kpi-dropdown-menu__item${selectedValue === option.value ? ' is-selected' : ''}`}
                            onClick={() => {
                                onSelect(option.value);
                                onToggle(false);
                            }}
                        >
                            <span>{option.label}</span>
                            <strong>{option.count}</strong>
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

function ProjectsEmptyState() {
    return (
        <div className="projects-empty-state">
            <svg viewBox="0 0 240 160" aria-hidden="true">
                <rect x="26" y="36" width="188" height="90" rx="18" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />
                <rect x="44" y="56" width="108" height="10" rx="5" fill="#dbeafe" />
                <rect x="44" y="78" width="132" height="10" rx="5" fill="#e2e8f0" />
                <rect x="44" y="100" width="82" height="10" rx="5" fill="#e2e8f0" />
                <circle cx="176" cy="74" r="22" fill="#eff6ff" stroke="#93c5fd" strokeWidth="2" />
                <path d="M186 90l14 14" stroke="#60a5fa" strokeWidth="6" strokeLinecap="round" />
                <circle cx="174" cy="72" r="10" fill="none" stroke="#2563eb" strokeWidth="4" />
            </svg>
            <h3>No projects found</h3>
            <p>Try clearing one of the filters, widening the date range, or searching for a broader term.</p>
        </div>
    );
}

export default function ProjectsDashboardPremium() {
    const [activeProjectCard, setActiveProjectCard] = useState(null);
    const [openDropdown, setOpenDropdown] = useState(null);

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
        dateRange,
        searchQuery,
        setSearchQuery,
        updateProjectFull,
    } = useProjects();

    const projectMatchesFilters = (project, overrides = {}) => {
        const {
            status = filterStatus,
            branch = filterBranch,
            manager = filterPM,
            query = searchQuery,
            startDate = dateRange.start,
            endDate = dateRange.end,
        } = overrides;

        if (query) {
            const normalizedQuery = query.toLowerCase();
            const matchesSearch =
                (project.project_name || '').toLowerCase().includes(normalizedQuery) ||
                (project.event_name || '').toLowerCase().includes(normalizedQuery) ||
                (project.crm_project_id || '').toLowerCase().includes(normalizedQuery) ||
                (project.venue || '').toLowerCase().includes(normalizedQuery) ||
                (project.branch || '').toLowerCase().includes(normalizedQuery) ||
                (project.city || '').toLowerCase().includes(normalizedQuery) ||
                normalizeBoardStage(project.board_stage).toLowerCase().includes(normalizedQuery) ||
                (project.project_manager || '').toLowerCase().includes(normalizedQuery);

            if (!matchesSearch) {
                return false;
            }
        }

        if (branch !== 'All' && project.branch !== branch) {
            return false;
        }

        if (manager !== 'All' && project.project_manager !== manager) {
            return false;
        }

        if (status !== 'All' && normalizeBoardStage(project.board_stage) !== status) {
            return false;
        }

        if ((startDate || endDate) && !project.event_start_date) {
            return false;
        }

        if (startDate && project.event_start_date && new Date(project.event_start_date) < new Date(startDate)) {
            return false;
        }

        if (endDate && project.event_start_date && new Date(project.event_start_date) > new Date(endDate)) {
            return false;
        }

        return true;
    };

    const allBranches = useMemo(
        () => [...new Set(projects.map((project) => project.branch).filter(Boolean))].sort(),
        [projects]
    );

    const allManagers = useMemo(
        () => [...new Set(projects.map((project) => project.project_manager).filter(Boolean))].sort(),
        [projects]
    );

    const stageScopedProjects = useMemo(
        () => projects.filter((project) => projectMatchesFilters(project, { status: 'All' })),
        [projects, filterBranch, filterPM, searchQuery, dateRange.start, dateRange.end]
    );

    const managerScopedProjects = useMemo(
        () => projects.filter((project) => projectMatchesFilters(project, { manager: 'All' })),
        [projects, filterStatus, filterBranch, searchQuery, dateRange.start, dateRange.end]
    );

    const branchScopedProjects = useMemo(
        () => projects.filter((project) => projectMatchesFilters(project, { branch: 'All' })),
        [projects, filterStatus, filterPM, searchQuery, dateRange.start, dateRange.end]
    );

    const branchOptions = useMemo(() => ([
        { value: 'All', label: 'All branches', count: branchScopedProjects.length },
        ...buildCountMap(branchScopedProjects, allBranches, (project) => project.branch),
    ]), [allBranches, branchScopedProjects]);

    const managerOptions = useMemo(() => ([
        { value: 'All', label: 'All managers', count: managerScopedProjects.length },
        ...buildCountMap(managerScopedProjects, allManagers, (project) => project.project_manager),
    ]), [allManagers, managerScopedProjects]);

    const stageOptions = useMemo(() => ([
        {
            value: 'All',
            label: 'All stages',
            count: stageScopedProjects.length,
        },
        ...buildCountMap(stageScopedProjects, EXECUTION_BOARD_STAGES, (project) => normalizeBoardStage(project.board_stage)),
    ]), [stageScopedProjects]);

    const stageCardCount = filterStatus === 'All' ? stageScopedProjects.length : filteredProjects.length;
    const managerCardCount = filterPM === 'All' ? managerScopedProjects.length : filteredProjects.length;
    const branchCardCount = filterBranch === 'All' ? branchScopedProjects.length : filteredProjects.length;

    const summary = useMemo(() => ({
        totalProjects: projects.length,
    }), [projects.length]);

    const latestActiveProject = projects.find((project) => project.id === activeProjectCard?.id) || activeProjectCard;
    const hasActiveViewState =
        filterStatus !== 'All' ||
        filterBranch !== 'All' ||
        filterPM !== 'All' ||
        searchQuery !== '' ||
        Boolean(dateRange.start) ||
        Boolean(dateRange.end);

    const resetFilters = () => {
        setFilterStatus('All');
        setFilterBranch('All');
        setFilterPM('All');
        setSearchQuery('');
        setOpenDropdown(null);
    };

    const headerCenter = (
        <label className="premium-search design-header-search">
            <Search size={16} color="var(--tx3)" />
            <input
                type="search"
                placeholder="Search project, event, venue, or manager"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
            />
        </label>
    );

    const actions = (
        <>
            <button type="button" className="premium-action-button" onClick={resetFilters} disabled={!hasActiveViewState}>
                <X size={14} />
                Reset Filters
            </button>
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
                subtitle="Execution pipeline, ownership, and delivery dates in one view."
                headerCenter={headerCenter}
                actions={actions}
                pageClassName="premium-page--projects"
            >
                <div className="premium-grid premium-grid--projects-kpis">
                    <KpiCard
                        icon={Briefcase}
                        label="Total Projects"
                        value={summary.totalProjects}
                        detail="Global total in database"
                        tone="blue"
                        onClick={resetFilters}
                    />
                    <DropdownKpiCard
                        icon={Layout}
                        label="Stage"
                        tone="orange"
                        selectedValue={filterStatus}
                        options={stageOptions}
                        totalCount={stageCardCount}
                        active={filterStatus !== 'All'}
                        open={openDropdown === 'stage'}
                        onToggle={(isOpen) => setOpenDropdown(isOpen ? 'stage' : null)}
                        onSelect={setFilterStatus}
                        totalDetail={`${stageScopedProjects.length} projects in view`}
                        selectedDetail={`${filteredProjects.length} projects in ${filterStatus}`}
                    />
                    <DropdownKpiCard
                        icon={UserCircle2}
                        label="Manager"
                        tone="green"
                        selectedValue={filterPM}
                        options={managerOptions}
                        totalCount={managerCardCount}
                        active={filterPM !== 'All'}
                        open={openDropdown === 'manager'}
                        onToggle={(isOpen) => setOpenDropdown(isOpen ? 'manager' : null)}
                        onSelect={setFilterPM}
                        totalDetail={`${managerScopedProjects.length} projects in view`}
                        selectedDetail={`${filteredProjects.length} projects handled by ${filterPM}`}
                    />
                    <DropdownKpiCard
                        icon={MapPin}
                        label="Branch"
                        tone="red"
                        selectedValue={filterBranch}
                        options={branchOptions}
                        totalCount={branchCardCount}
                        active={filterBranch !== 'All'}
                        open={openDropdown === 'branch'}
                        onToggle={(isOpen) => setOpenDropdown(isOpen ? 'branch' : null)}
                        onSelect={setFilterBranch}
                        totalDetail={`${branchScopedProjects.length} projects in view`}
                        selectedDetail={`${filteredProjects.length} projects in ${filterBranch}`}
                    />
                </div>

                {error ? (
                    <div className="premium-banner">
                        {error}
                    </div>
                ) : null}

                <div className="premium-panel project-dashboard-panel">
                    {hasActiveViewState ? (
                        <div className="project-dashboard-actionbar" aria-live="polite">
                            <div className="project-dashboard-actionbar__content">
                                <div className="project-dashboard-actionbar__summary">
                                    {`Showing ${filteredProjects.length} of ${projects.length} projects`}
                                </div>
                            </div>
                        </div>
                    ) : null}

                    <div className="premium-table-scroll premium-table-scroll--projects">
                        {loading && projects.length === 0 ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', padding: '24px' }}>
                                <CardSkeleton />
                                <CardSkeleton />
                                <CardSkeleton />
                            </div>
                        ) : filteredProjects.length === 0 ? (
                            <ProjectsEmptyState />
                        ) : (
                            <ProjectTable
                                projects={filteredProjects}
                                loading={loading}
                                updateProjectFull={updateProjectFull}
                                onDoubleClickProject={setActiveProjectCard}
                            />
                        )}
                    </div>
                </div>
            </AppShell>
        </>
    );
}
