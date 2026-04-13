import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Building2, FolderKanban, PanelLeft, Search, Users, Workflow, X } from 'lucide-react';
import { useProjects } from '../hooks/useProjects';
import ProjectTable from '../components/ProjectTable';
import AppShell from '../components/app/AppShell';
import KpiCard from '../components/app/KpiCard';
import AlertBanner from '../components/AlertBanner';
import GlobalDateRangePicker from '../components/GlobalDateRangePicker';
import { EXECUTION_BOARD_STAGES } from '../utils/projectStatus';

const ProjectBoardModal = lazy(() => import('../components/ProjectBoardModal'));

export default function ProjectsDashboardPremium() {
    const [selectedProject, setSelectedProject] = useState(null);
    const [activeProjectCard, setActiveProjectCard] = useState(null);

    const {
        projects,
        filteredProjects,
        loading,
        error,
        filterStage,
        setFilterStage,
        filterBranch,
        setFilterBranch,
        filterPM,
        setFilterPM,
        filterStatus,
        setFilterStatus,
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
    const [isStageMenuOpen, setIsStageMenuOpen] = useState(false);
    const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);
    const [isManagerMenuOpen, setIsManagerMenuOpen] = useState(false);
    const stageMenuRef = useRef(null);
    const branchMenuRef = useRef(null);
    const managerMenuRef = useRef(null);
    const activeProjects = useMemo(() => projects.filter((project) => project.stage?.toLowerCase() === 'win'), [projects]);
    const totalProjects = activeProjects.length;
    const stageCounts = useMemo(
        () => EXECUTION_BOARD_STAGES.reduce((acc, stage) => {
            acc[stage] = activeProjects.filter((project) => project.board_stage === stage).length;
            return acc;
        }, {}),
        [activeProjects]
    );
    const stagesCount = EXECUTION_BOARD_STAGES.length;
    const activeStageCount = filterStatus !== 'All' ? (stageCounts[filterStatus] ?? 0) : stagesCount;
    const totalBranches = Math.max(0, uniqueBranches.length - 1);
    const totalManagers = Math.max(0, uniquePMs.length - 1);
    const branchCounts = useMemo(
        () => uniqueBranches.reduce((acc, branch) => {
            if (branch !== 'All') {
                acc[branch] = activeProjects.filter((project) => project.branch === branch).length;
            }
            return acc;
        }, {}),
        [activeProjects, uniqueBranches]
    );
    const managerCounts = useMemo(
        () => uniquePMs.reduce((acc, manager) => {
            if (manager !== 'All') {
                acc[manager] = activeProjects.filter((project) => project.project_manager === manager).length;
            }
            return acc;
        }, {}),
        [activeProjects, uniquePMs]
    );
    const hasActiveFilters =
        filterStage !== 'All' ||
        filterStatus !== 'All' ||
        filterBranch !== 'All' ||
        filterPM !== 'All' ||
        searchQuery !== '';

    useEffect(() => {
        setFilterPriority('All');
    }, [setFilterPriority]);

    useEffect(() => {
        const onClickOutside = (event) => {
            if (stageMenuRef.current && !stageMenuRef.current.contains(event.target)) {
                setIsStageMenuOpen(false);
            }
            if (branchMenuRef.current && !branchMenuRef.current.contains(event.target)) {
                setIsBranchMenuOpen(false);
            }
            if (managerMenuRef.current && !managerMenuRef.current.contains(event.target)) {
                setIsManagerMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    const resetFilters = () => {
        setFilterStage('All');
        setFilterStatus('All');
        setFilterBranch('All');
        setFilterPM('All');
        setFilterPriority('All');
        setSearchQuery('');
        setSelectedProject(null);
        setActiveProjectCard(null);
    };

    const handleStageSelect = (stage) => {
        setFilterStatus(stage);
        setIsStageMenuOpen(false);
    };

    const handleBranchSelect = (branch) => {
        setFilterBranch(branch);
        setIsBranchMenuOpen(false);
    };

    const handleManagerSelect = (manager) => {
        setFilterPM(manager);
        setIsManagerMenuOpen(false);
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
                    <PanelLeft size={18} strokeWidth={2} aria-hidden />
                </button>
            ) : null}

            <header className="design-dashboard__header projects-dashboard__header">
                <div className="design-dashboard__header-scroll projects-dashboard__header-scroll">
                    <div className="design-dashboard__header-filters projects-dashboard__header-filters projects-dashboard__filters-subsection">
                        <div className="design-dashboard__filter-field design-dashboard__filter-field--search">
                            <span className="design-dashboard__filter-label" id="projects-search-label">
                                Search
                            </span>
                            <label className="design-dashboard__search">
                                <Search size={16} aria-hidden />
                                <input
                                    type="search"
                                    placeholder="Search project, event, venue, manager..."
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    aria-labelledby="projects-search-label"
                                />
                            </label>
                        </div>

                        <div className="design-dashboard__filter-field design-dashboard__filter-field--stage">
                            <span className="design-dashboard__filter-label" id="projects-stage-label">
                                Execution stage
                            </span>
                            <label className="design-dashboard__control design-dashboard__control--select">
                                <select
                                    value={filterStatus}
                                    onChange={(event) => setFilterStatus(event.target.value)}
                                    aria-labelledby="projects-stage-label"
                                >
                                    <option value="All">All stages</option>
                                    {EXECUTION_BOARD_STAGES.map((stage) => (
                                        <option key={stage} value={stage}>
                                            {stage}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <div className="design-dashboard__filter-field design-dashboard__filter-field--branch">
                            <span className="design-dashboard__filter-label" id="projects-branch-label">
                                Branch
                            </span>
                            <label className="design-dashboard__control design-dashboard__control--select">
                                <select
                                    value={filterBranch}
                                    onChange={(event) => setFilterBranch(event.target.value)}
                                    aria-labelledby="projects-branch-label"
                                >
                                    {uniqueBranches.map((branch) => (
                                        <option key={branch} value={branch}>
                                            {branch === 'All' ? 'All branches' : branch}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <div className="design-dashboard__filter-field design-dashboard__filter-field--manager">
                            <span className="design-dashboard__filter-label" id="projects-manager-label">
                                Manager
                            </span>
                            <label className="design-dashboard__control design-dashboard__control--select">
                                <select
                                    value={filterPM}
                                    onChange={(event) => setFilterPM(event.target.value)}
                                    aria-labelledby="projects-manager-label"
                                >
                                    {uniquePMs.map((manager) => (
                                        <option key={manager} value={manager}>
                                            {manager === 'All' ? 'All managers' : manager}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <div className="design-dashboard__filter-field design-dashboard__filter-field--date">
                            <span className="design-dashboard__filter-label" id="projects-date-label">
                                Date range
                            </span>
                            <GlobalDateRangePicker
                                compact
                                label={false}
                                className="design-dashboard__date-range projects-dashboard__date-range"
                                aria-labelledby="projects-date-label"
                            />
                        </div>

                        {hasActiveFilters ? (
                            <button
                                type="button"
                                className="design-dashboard__action-button projects-dashboard__reset-button"
                                onClick={resetFilters}
                                title="Clear filters"
                            >
                                <X size={15} />
                                Reset
                            </button>
                        ) : null}
                    </div>
                </div>
            </header>
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
                header={header}
                showGlobalDate={false}
                mainClassName="premium-main--design"
                pageClassName="design-dashboard-page"
                sidebarOverlay
            >
                <AlertBanner message={error} />

                <div className="design-dashboard__kpi-grid design-dashboard__kpi-grid--projects">
                    <KpiCard
                        icon={FolderKanban}
                        label="Total Projects"
                        value={totalProjects}
                        active={filterStage === 'All' && filterStatus === 'All'}
                        onClick={resetFilters}
                        className="design-dashboard__kpi design-dashboard__kpi--all projects-dashboard__kpi"
                    />
                    <div className="projects-dashboard__kpi-dropdown" ref={stageMenuRef}>
                        <KpiCard
                            icon={Workflow}
                            label="Stages"
                            value={activeStageCount}
                            active={filterStatus !== 'All' || isStageMenuOpen}
                            onClick={() => {
                                setIsStageMenuOpen((open) => !open);
                                setIsBranchMenuOpen(false);
                                setIsManagerMenuOpen(false);
                            }}
                            className="design-dashboard__kpi design-dashboard__kpi--pending projects-dashboard__kpi"
                        />
                        {isStageMenuOpen ? (
                            <div className="projects-dashboard__kpi-menu">
                                <button type="button" className="projects-dashboard__kpi-menu-item" onClick={() => handleStageSelect('All')}>
                                    All stages
                                    <strong>{totalProjects}</strong>
                                </button>
                                {EXECUTION_BOARD_STAGES.map((stage) => (
                                    <button key={stage} type="button" className="projects-dashboard__kpi-menu-item" onClick={() => handleStageSelect(stage)}>
                                        {stage}
                                        <strong>{stageCounts[stage] ?? 0}</strong>
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </div>
                    <div className="projects-dashboard__kpi-dropdown" ref={branchMenuRef}>
                        <KpiCard
                            icon={Building2}
                            label="Branch"
                            value={filterBranch === 'All' ? totalBranches : (branchCounts[filterBranch] ?? 0)}
                            active={filterBranch !== 'All' || isBranchMenuOpen}
                            onClick={() => {
                                setIsBranchMenuOpen((open) => !open);
                                setIsManagerMenuOpen(false);
                                setIsStageMenuOpen(false);
                            }}
                            className="design-dashboard__kpi design-dashboard__kpi--in-progress projects-dashboard__kpi"
                        />
                        {isBranchMenuOpen ? (
                            <div className="projects-dashboard__kpi-menu">
                                <button type="button" className="projects-dashboard__kpi-menu-item" onClick={() => handleBranchSelect('All')}>
                                    All branches
                                    <strong>{totalProjects}</strong>
                                </button>
                                {uniqueBranches.filter((branch) => branch !== 'All').map((branch) => (
                                    <button key={branch} type="button" className="projects-dashboard__kpi-menu-item" onClick={() => handleBranchSelect(branch)}>
                                        {branch}
                                        <strong>{branchCounts[branch] ?? 0}</strong>
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </div>
                    <div className="projects-dashboard__kpi-dropdown" ref={managerMenuRef}>
                        <KpiCard
                            icon={Users}
                            label="Managers"
                            value={filterPM === 'All' ? totalManagers : (managerCounts[filterPM] ?? 0)}
                            active={filterPM !== 'All' || isManagerMenuOpen}
                            onClick={() => {
                                setIsManagerMenuOpen((open) => !open);
                                setIsBranchMenuOpen(false);
                                setIsStageMenuOpen(false);
                            }}
                            className="design-dashboard__kpi design-dashboard__kpi--won projects-dashboard__kpi"
                        />
                        {isManagerMenuOpen ? (
                            <div className="projects-dashboard__kpi-menu">
                                <button type="button" className="projects-dashboard__kpi-menu-item" onClick={() => handleManagerSelect('All')}>
                                    All managers
                                    <strong>{totalProjects}</strong>
                                </button>
                                {uniquePMs.filter((manager) => manager !== 'All').map((manager) => (
                                    <button key={manager} type="button" className="projects-dashboard__kpi-menu-item" onClick={() => handleManagerSelect(manager)}>
                                        {manager}
                                        <strong>{managerCounts[manager] ?? 0}</strong>
                                    </button>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="design-dashboard__table-shell">
                    {loading && projects.length === 0 ? (
                        <div className="loading-row design-dashboard__loading">Loading execution projects...</div>
                    ) : (
                        <ProjectTable
                            projects={filteredProjects}
                            loading={loading}
                            selectedProject={selectedProject}
                            onSelectProject={setSelectedProject}
                            onDoubleClickProject={setActiveProjectCard}
                            onUpdateStage={(projectId, nextStage) => updateProjectFull(projectId, { board_stage: nextStage })}
                        />
                    )}
                </div>
            </AppShell>
        </>
    );
}
