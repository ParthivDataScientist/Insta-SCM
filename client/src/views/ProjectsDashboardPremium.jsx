import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Building2, FolderKanban, PanelLeft, Search, Users, Workflow, X, MapPin, Layout, Bell } from 'lucide-react';
import { useProjects } from '../hooks/useProjects';
import ProjectTable from '../components/ProjectTable';
import AppShell from '../components/app/AppShell';
import KpiCard from '../components/app/KpiCard';
import AlertBanner from '../components/AlertBanner';
import GlobalDateRangePicker from '../components/GlobalDateRangePicker';
import PremiumDateRangePicker from '../components/PremiumDateRangePicker';
import '../design-premium.css';
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
                    style={{ marginRight: '8px' }}
                >
                    <PanelLeft size={18} strokeWidth={2} />
                </button>
            ) : null}

            <header className="design-premium-header">
                <div className="design-premium-header__inner">
                    <div className="design-premium-header__brand" style={{ marginRight: '16px' }}>
                        <img src="/logo.jpg" alt="Insta-SCM Logo" className="design-premium-header__logo" />
                    </div>

                    <div className="design-premium-header__search-container">
                        <label className="design-premium-search">
                            <Search size={16} className="design-premium-search__icon" aria-hidden />
                            <input
                                type="search"
                                placeholder="Search project, event, venue, manager..."
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                            />
                        </label>
                    </div>

                    <div className="design-premium-header__filters">
                        <div className="design-premium-filter">
                            <div className="design-premium-filter__label">Board Stage
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginLeft: "4px"}}><path d="M6 9l6 6 6-6"/></svg>
                            </div>
                            <label className="design-premium-filter__control">
                                <Layout size={14} className="design-premium-filter__icon" />
                                <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
                                    <option value="All">All stages</option>
                                    {EXECUTION_BOARD_STAGES.map((stage) => (
                                        <option key={stage} value={stage}>{stage}</option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <div className="design-premium-filter">
                            <div className="design-premium-filter__label">Branch
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginLeft: "4px"}}><path d="M6 9l6 6 6-6"/></svg>
                            </div>
                            <label className="design-premium-filter__control">
                                <MapPin size={14} className="design-premium-filter__icon" />
                                <select value={filterBranch} onChange={(event) => setFilterBranch(event.target.value)}>
                                    {uniqueBranches.map(b => (
                                        <option key={b} value={b}>{b === 'All' ? 'All branches' : b}</option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <div className="design-premium-filter">
                            <div className="design-premium-filter__label">Manager
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginLeft: "4px"}}><path d="M6 9l6 6 6-6"/></svg>
                            </div>
                            <label className="design-premium-filter__control">
                                <Users size={14} className="design-premium-filter__icon" />
                                <select value={filterPM} onChange={(event) => setFilterPM(event.target.value)}>
                                    {uniquePMs.map(pm => (
                                        <option key={pm} value={pm}>{pm === 'All' ? 'All managers' : pm}</option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <div className="design-premium-filter">
                            <div className="design-premium-filter__label">Date range</div>
                            <PremiumDateRangePicker />
                        </div>
                    </div>

                    <div className="design-premium-header__actions">
                        {hasActiveFilters && (
                            <button
                                type="button"
                                className="design-premium-btn"
                                style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
                                onClick={resetFilters}
                                title="Clear all filters"
                            >
                                <X size={14} /> Clear
                            </button>
                        )}

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
