import React, { Suspense, lazy } from 'react';
import { AlertTriangle, Bell, CheckCircle2, Clock3, FileText, FolderOpen, LogOut, Menu, Moon, PanelLeft, PenTool, RefreshCw, Search, Sun, SlidersHorizontal } from 'lucide-react';
import { useDesignProjects } from '../hooks/useDesignProjects';
import AlertBanner from '../components/AlertBanner';
import DesignTable from '../components/DesignTable';
import DesignTableSkeleton from '../components/DesignTableSkeleton';
import GlobalDateRangePicker from '../components/GlobalDateRangePicker';
import PremiumDateRangePicker from '../components/PremiumDateRangePicker';
import AppShell from '../components/app/AppShell';
import KpiCard from '../components/app/KpiCard';
import '../design-dashboard.css';

const ProjectBoardModal = lazy(() => import('../components/ProjectBoardModal'));

export default function DesignDashboard() {
    const [selectedProject, setSelectedProject] = React.useState(null);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const {
        tableProjects,
        designStats,
        loading,
        error,
        filters,
        setSearchQuery,
        setFilterStatus,
        setClientId,
        setCity,
        setActiveKpi,
        updateDesignStatus,
        loadData,
    } = useDesignProjects();

    React.useEffect(() => {
        if (filters.clientId !== 'all') {
            setClientId('all');
        }
        if (filters.city !== 'all') {
            setCity('all');
        }
    }, [filters.city, filters.clientId, setCity, setClientId]);

    const handleUpdateStatus = async (id, data) => {
        try {
            await updateDesignStatus({ id, data });
        } catch (err) {
            alert(err.response?.data?.detail || err.message || 'Unable to update design status');
        }
    };

    const handleRefresh = async () => {
        const startedAt = Date.now();
        setIsRefreshing(true);
        try {
            await Promise.resolve(loadData());
        } finally {
            const elapsed = Date.now() - startedAt;
            const remaining = Math.max(0, 500 - elapsed);
            window.setTimeout(() => setIsRefreshing(false), remaining);
        }
    };

    const latestSelectedProject = tableProjects.find((project) => project.id === selectedProject?.id) || selectedProject;

    const header = ({ isDark, toggleTheme, logout, toggleSidebar, sidebarOverlay, sidebarOpen }) => (
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
            <header className="design-premium-header">
                <div className="design-premium-header__inner">
                    
                    <div className="design-premium-header__brand">
                        <img src="/logo.jpg" alt="App Logo" className="design-premium-header__logo" />
                    </div>

                    <div className="design-premium-header__search-container">
                        <label className="design-premium-search">
                            <Search size={16} className="design-premium-search__icon" aria-hidden />
                            <input
                                type="search"
                                placeholder="Search projects, clients, or AWS accounts..."
                                value={filters.search}
                                onChange={(event) => setSearchQuery(event.target.value)}
                            />
                        </label>
                    </div>

                    <div className="design-premium-header__filters">
                        <div className="design-premium-filter">
                            <div className="design-premium-filter__label">Status
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginLeft: "4px"}}><path d="M6 9l6 6 6-6"/></svg>
                            </div>
                            <label className="design-premium-filter__control">
                                <SlidersHorizontal size={14} className="design-premium-filter__icon" />
                                <select
                                    value={filters.status}
                                    onChange={(event) => setFilterStatus(event.target.value)}
                                >
                                    <option value="all">All statuses</option>
                                    <option value="pending">Pending</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="changes">Changes</option>
                                    <option value="won">Won</option>
                                    <option value="lost">Lost</option>
                                </select>
                            </label>
                        </div>

                        <div className="design-premium-filter">
                            <div className="design-premium-filter__label">Date range</div>
                            <PremiumDateRangePicker />
                        </div>
                    </div>

                    <div className="design-premium-header__actions">
                        <button
                            type="button"
                            className="design-premium-btn design-premium-btn--primary"
                            onClick={handleRefresh}
                            disabled={loading || isRefreshing}
                        >
                            <RefreshCw size={15} style={{ animation: loading || isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
                            Refresh
                        </button>
                        
                        <button
                            type="button"
                            className="design-premium-icon-btn"
                            onClick={toggleTheme}
                            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                        >
                            {isDark ? <Sun size={18} /> : <Moon size={18} />}
                        </button>

                        <button
                            type="button"
                            className="design-premium-icon-btn"
                            title="Notifications"
                        >
                            <Bell size={18} />
                            <span className="design-premium-icon-btn__badge"></span>
                        </button>

                        <button
                            type="button"
                            className="design-premium-avatar"
                            onClick={logout}
                            title="Logout"
                        >
                            JD
                        </button>
                    </div>
                </div>
            </header>
        </>
    );

    return (
        <>
            <Suspense fallback={null}>
                {latestSelectedProject ? (
                    <ProjectBoardModal
                        project={latestSelectedProject}
                        onClose={() => setSelectedProject(null)}
                        updateProjectFull={handleUpdateStatus}
                        onProjectRefresh={loadData}
                    />
                ) : null}
            </Suspense>

            <AppShell
                activeNav="design"
                header={header}
                showGlobalDate={false}
                mainClassName="premium-main--design"
                pageClassName="design-dashboard-page"
                sidebarOverlay
            >
                <AlertBanner message={error} />

                <div className="design-dashboard__kpi-grid">
                    <KpiCard
                        icon={FileText}
                        label="Total Brief"
                        value={designStats.total_brief ?? 0}
                        active={filters.activeKpi === 'all'}
                        onClick={() => setActiveKpi('all')}
                        className="design-dashboard__kpi design-dashboard__kpi--all"
                    />
                    <KpiCard
                        icon={Clock3}
                        label="Pending"
                        value={designStats.pending_count ?? 0}
                        tone="neutral"
                        active={filters.activeKpi === 'pending'}
                        onClick={() => setActiveKpi(filters.activeKpi === 'pending' ? 'all' : 'pending')}
                        className="design-dashboard__kpi design-dashboard__kpi--pending"
                    />
                    <KpiCard
                        icon={RefreshCw}
                        label="In Progress"
                        value={designStats.in_progress_count ?? 0}
                        tone="blue"
                        active={filters.activeKpi === 'in_progress'}
                        onClick={() => setActiveKpi(filters.activeKpi === 'in_progress' ? 'all' : 'in_progress')}
                        className="design-dashboard__kpi design-dashboard__kpi--in-progress"
                    />
                    <KpiCard
                        icon={PenTool}
                        label="Changes"
                        value={designStats.changes_count ?? 0}
                        tone="orange"
                        active={filters.activeKpi === 'changes'}
                        onClick={() => setActiveKpi(filters.activeKpi === 'changes' ? 'all' : 'changes')}
                        className="design-dashboard__kpi design-dashboard__kpi--changes"
                    />
                    <KpiCard
                        icon={CheckCircle2}
                        label="Won"
                        value={designStats.won_count ?? 0}
                        tone="green"
                        active={filters.activeKpi === 'won'}
                        onClick={() => setActiveKpi(filters.activeKpi === 'won' ? 'all' : 'won')}
                        className="design-dashboard__kpi design-dashboard__kpi--won"
                    />
                    <KpiCard
                        icon={AlertTriangle}
                        label="Lost"
                        value={designStats.lost_count ?? 0}
                        tone="red"
                        active={filters.activeKpi === 'lost'}
                        onClick={() => setActiveKpi(filters.activeKpi === 'lost' ? 'all' : 'lost')}
                        className="design-dashboard__kpi design-dashboard__kpi--lost"
                    />
                    <KpiCard
                        icon={FolderOpen}
                        label="Open"
                        value={designStats.open_count ?? 0}
                        active={filters.activeKpi === 'open'}
                        onClick={() => setActiveKpi(filters.activeKpi === 'open' ? 'all' : 'open')}
                        className="design-dashboard__kpi design-dashboard__kpi--open"
                    />
                </div>

                <div className="design-dashboard__table-shell">
                    {loading && tableProjects.length === 0 ? (
                        <DesignTableSkeleton />
                    ) : (
                        <DesignTable
                            projects={tableProjects}
                            onUpdateStatus={handleUpdateStatus}
                            onUpdateField={handleUpdateStatus}
                            onOpenProject={setSelectedProject}
                        />
                    )}
                </div>
            </AppShell>
        </>
    );
}
