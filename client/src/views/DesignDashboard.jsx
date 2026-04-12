import React, { Suspense, lazy } from 'react';
import { LogOut, Menu, Moon, RefreshCw, Search, Sun } from 'lucide-react';
import { useDesignProjects } from '../hooks/useDesignProjects';
import AlertBanner from '../components/AlertBanner';
import DesignTable from '../components/DesignTable';
import GlobalDateRangePicker from '../components/GlobalDateRangePicker';
import AppShell from '../components/app/AppShell';
import KpiCard from '../components/app/KpiCard';
import '../design-dashboard.css';

const ProjectBoardModal = lazy(() => import('../components/ProjectBoardModal'));

export default function DesignDashboard() {
    const [selectedProject, setSelectedProject] = React.useState(null);
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

    const latestSelectedProject = tableProjects.find((project) => project.id === selectedProject?.id) || selectedProject;

    const header = ({ isDark, toggleTheme, logout, toggleSidebar }) => (
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

                <label className="design-dashboard__search">
                    <Search size={16} />
                    <input
                        placeholder="Search project, client, or AWB"
                        value={filters.search}
                        onChange={(event) => setSearchQuery(event.target.value)}
                    />
                </label>

                <label className="design-dashboard__control design-dashboard__control--select">
                    <select value={filters.status} onChange={(event) => setFilterStatus(event.target.value)}>
                        <option value="all">Status</option>
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="changes">Changes</option>
                        <option value="won">Won</option>
                        <option value="lost">Lost</option>
                    </select>
                </label>

                <GlobalDateRangePicker compact label="Date Range" className="design-dashboard__date-range" />

                <button
                    type="button"
                    className="design-dashboard__action-button"
                    onClick={loadData}
                    disabled={loading}
                >
                    <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                    Refresh
                </button>

                <button
                    type="button"
                    className="design-dashboard__action-button"
                    onClick={toggleTheme}
                    title="Toggle dark mode"
                >
                    {isDark ? <Sun size={15} /> : <Moon size={15} />}
                    {isDark ? 'Light' : 'Dark'}
                </button>

                <button
                    type="button"
                    className="design-dashboard__action-button design-dashboard__action-button--danger"
                    onClick={logout}
                    title="Logout"
                >
                    <LogOut size={15} />
                    Logout
                </button>
            </div>
        </header>
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
            >
                <AlertBanner message={error} />

                <div className="design-dashboard__kpi-grid">
                    <KpiCard
                        label="Total Brief"
                        value={designStats.total_brief ?? 0}
                        active={filters.activeKpi === 'all'}
                        onClick={() => setActiveKpi('all')}
                        className="design-dashboard__kpi design-dashboard__kpi--all"
                    />
                    <KpiCard
                        label="Pending"
                        value={designStats.pending_count ?? 0}
                        tone="neutral"
                        active={filters.activeKpi === 'pending'}
                        onClick={() => setActiveKpi(filters.activeKpi === 'pending' ? 'all' : 'pending')}
                        className="design-dashboard__kpi design-dashboard__kpi--pending"
                    />
                    <KpiCard
                        label="In Progress"
                        value={designStats.in_progress_count ?? 0}
                        tone="blue"
                        active={filters.activeKpi === 'in_progress'}
                        onClick={() => setActiveKpi(filters.activeKpi === 'in_progress' ? 'all' : 'in_progress')}
                        className="design-dashboard__kpi design-dashboard__kpi--in-progress"
                    />
                    <KpiCard
                        label="Changes"
                        value={designStats.changes_count ?? 0}
                        tone="orange"
                        active={filters.activeKpi === 'changes'}
                        onClick={() => setActiveKpi(filters.activeKpi === 'changes' ? 'all' : 'changes')}
                        className="design-dashboard__kpi design-dashboard__kpi--changes"
                    />
                    <KpiCard
                        label="Won"
                        value={designStats.won_count ?? 0}
                        tone="green"
                        active={filters.activeKpi === 'won'}
                        onClick={() => setActiveKpi(filters.activeKpi === 'won' ? 'all' : 'won')}
                        className="design-dashboard__kpi design-dashboard__kpi--won"
                    />
                    <KpiCard
                        label="Lost"
                        value={designStats.lost_count ?? 0}
                        tone="red"
                        active={filters.activeKpi === 'lost'}
                        onClick={() => setActiveKpi(filters.activeKpi === 'lost' ? 'all' : 'lost')}
                        className="design-dashboard__kpi design-dashboard__kpi--lost"
                    />
                    <KpiCard
                        label="Open"
                        value={designStats.open_count ?? 0}
                        active={filters.activeKpi === 'open'}
                        onClick={() => setActiveKpi(filters.activeKpi === 'open' ? 'all' : 'open')}
                        className="design-dashboard__kpi design-dashboard__kpi--open"
                    />
                </div>

                <div className="design-dashboard__table-shell">
                    {loading && tableProjects.length === 0 ? (
                        <div className="loading-row design-dashboard__loading">Loading design briefs...</div>
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
