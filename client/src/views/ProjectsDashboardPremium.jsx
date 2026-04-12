import React, { Suspense, lazy, useMemo, useState, useRef, useEffect } from 'react';
import { Briefcase, Layout, Target, MapPin, RefreshCw, Search, X, Menu } from 'lucide-react';
import { useProjects } from '../hooks/useProjects';
import ProjectTable from '../components/ProjectTable';
import { CardSkeleton } from '../components/SkeletonLoader';
import AppShell from '../components/app/AppShell';
import KpiCard from '../components/app/KpiCard';
import AlertBanner from '../components/AlertBanner';
import GlobalDateRangePicker from '../components/GlobalDateRangePicker';
import { EXECUTION_BOARD_STAGES } from '../utils/projectStatus';

const ProjectBoardModal = lazy(() => import('../components/ProjectBoardModal'));

function DropdownKpi({ label, value, detail, tone, icon, active, options, selectedValue, onSelect, className = '' }) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div ref={containerRef} style={{ position: 'relative' }}>
            <KpiCard
                label={label}
                value={value}
                detail={detail}
                tone={tone}
                active={active || isOpen}
                icon={icon}
                className={className}
                onClick={() => setIsOpen(!isOpen)}
            />
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 100,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    marginTop: '4px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    maxHeight: '240px',
                    overflowY: 'auto'
                }}>
                    {options.map((opt) => (
                        <div
                            key={opt}
                            style={{
                                padding: '10px 14px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                borderBottom: '1px solid var(--border)',
                                background: selectedValue === opt ? 'var(--bg-hover)' : 'transparent',
                                fontWeight: selectedValue === opt ? '600' : '400',
                                color: 'var(--text-primary)'
                            }}
                            onClick={() => { onSelect(opt); setIsOpen(false); }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = selectedValue === opt ? 'var(--bg-hover)' : 'transparent'}
                        >
                            {opt === 'All' ? `All ${label.toLowerCase()}s` : opt}
                        </div>
                    ))}
                </div>
            )}
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
        filterPriority,
        setFilterPriority,
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

    const latestActiveProject = projects.find((project) => project.id === activeProjectCard?.id) || activeProjectCard;
    const hasActiveFilters =
        filterStatus !== 'All' ||
        filterBranch !== 'All' ||
        filterPM !== 'All' ||
        filterPriority !== 'All' ||
        searchQuery !== '';

    const resetFilters = () => {
        setFilterStatus('All');
        setFilterBranch('All');
        setFilterPM('All');
        setFilterPriority('All');
        setSearchQuery('');
        setSelectedProject(null);
        setActiveProjectCard(null);
    };

    const header = ({ toggleSidebar }) => (
        <header className="design-dashboard__header">
            <div className="design-dashboard__header-scroll">
                <button
                    type="button"
                    className="design-dashboard__icon-button mobile-only"
                    onClick={toggleSidebar}
                    title="Open navigation"
                >
                    <Menu size={16} />
                </button>

                <div className="design-dashboard__title" style={{ marginRight: '16px', display: 'flex', flexDirection: 'column' }}>
                    <h1 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>Projects</h1>
                </div>

                <label className="design-dashboard__search" style={{ minWidth: '300px' }}>
                    <Search size={16} />
                    <input
                        placeholder="Search project, event, venue, manager..."
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                    />
                </label>

                <GlobalDateRangePicker compact label="Date Range" className="design-dashboard__date-range" />

                {hasActiveFilters && (
                    <button
                        type="button"
                        className="design-dashboard__action-button"
                        onClick={resetFilters}
                        title="Clear filters"
                    >
                        <X size={15} style={{ marginRight: '4px' }} />
                        Reset Filters
                    </button>
                )}

                <button
                    type="button"
                    className="design-dashboard__action-button"
                    onClick={loadData}
                    disabled={loading}
                    style={{ background: 'var(--accent)', color: 'white', border: 'none' }}
                >
                    <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                    Refresh
                </button>
            </div>
        </header>
    );

    const stagesOptions = ['All', ...EXECUTION_BOARD_STAGES];

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
                header={header}
                showGlobalDate={false}
            >
                <div className="design-dashboard__kpi-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                    <KpiCard
                        icon={Briefcase}
                        label="TOTAL PROJECTS"
                        value={projects.length}
                        detail="Global total in database"
                        tone="neutral"
                        className="design-dashboard__kpi design-dashboard__kpi--all"
                    />
                    <DropdownKpi
                        icon={Layout}
                        label="STAGE"
                        value={filterStatus === 'All' ? filteredProjects.length : filteredProjects.length}
                        detail={`${filteredProjects.length} projects in view`}
                        tone="orange"
                        active={filterStatus !== 'All'}
                        options={stagesOptions}
                        selectedValue={filterStatus}
                        onSelect={setFilterStatus}
                        className="design-dashboard__kpi design-dashboard__kpi--pending"
                    />
                    <DropdownKpi
                        icon={Target}
                        label="MANAGER"
                        value={filterPM === 'All' ? filteredProjects.length : filteredProjects.length}
                        detail={`${filteredProjects.length} projects in view`}
                        tone="green"
                        active={filterPM !== 'All'}
                        options={uniquePMs}
                        selectedValue={filterPM}
                        onSelect={setFilterPM}
                        className="design-dashboard__kpi design-dashboard__kpi--won"
                    />
                    <DropdownKpi
                        icon={MapPin}
                        label="BRANCH"
                        value={filterBranch === 'All' ? filteredProjects.length : filteredProjects.length}
                        detail={`${filteredProjects.length} projects in view`}
                        tone="red"
                        active={filterBranch !== 'All'}
                        options={uniqueBranches}
                        selectedValue={filterBranch}
                        onSelect={setFilterBranch}
                        className="design-dashboard__kpi design-dashboard__kpi--lost"
                    />
                </div>

                <AlertBanner message={error} />

                <div className="design-dashboard__table-shell">
                    {loading && projects.length === 0 ? (
                        <div className="loading-row design-dashboard__loading">Loading execution projects...</div>
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
