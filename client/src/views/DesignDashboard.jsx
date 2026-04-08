import React from 'react';
import {
    Briefcase,
    CheckCircle2,
    RefreshCw,
    Search,
    TimerReset,
    WandSparkles,
    XCircle,
} from 'lucide-react';
import { useDesignProjects } from '../hooks/useDesignProjects';
import DesignTable from '../components/DesignTable';
import AppShell from '../components/app/AppShell';
import KpiCard from '../components/app/KpiCard';

export default function DesignDashboard() {
    const {
        tableProjects,
        designStats,
        loading,
        syncing,
        error,
        filters,
        setSearchQuery,
        setActiveKpi,
        updateDesignStatus,
        syncCrmFeed,
        loadData,
    } = useDesignProjects();

    const handleSyncCrm = async () => {
        try {
            await syncCrmFeed();
        } catch (err) {
            alert(err.response?.data?.detail || err.message || 'CRM sync failed');
        }
    };

    const handleUpdateStatus = async (id, data) => {
        try {
            await updateDesignStatus({ id, data });
        } catch (err) {
            alert(err.response?.data?.detail || err.message || 'Unable to update design status');
        }
    };

    const headerSearch = (
        <div className="premium-search design-header-search">
            <Search size={15} color="var(--tx3)" />
            <input
                placeholder="Search project, client, or AWB"
                value={filters.search}
                onChange={(event) => setSearchQuery(event.target.value)}
            />
        </div>
    );

    const shellActions = (
        <>
            <button
                type="button"
                className="premium-action-button"
                onClick={loadData}
                disabled={loading}
            >
                <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                Refresh
            </button>
            <button
                type="button"
                className="premium-action-button premium-action-button--primary"
                onClick={handleSyncCrm}
                disabled={syncing}
            >
                <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
                {syncing ? 'Syncing' : 'Sync CRM'}
            </button>
        </>
    );

    return (
        <AppShell
            activeNav="design"
            title="Design"
            headerCenter={headerSearch}
            actions={shellActions}
            showLogout
            pageClassName="premium-page--design"
        >
            {error ? <div className="premium-banner">{error}</div> : null}

            <div className="premium-kpi-strip" role="group" aria-label="Design KPI filters">
                <KpiCard
                    icon={Briefcase}
                    label="Total Brief"
                    value={designStats.total_brief ?? 0}
                    detail="All briefs after current filters"
                    active={filters.activeKpi === 'all'}
                    onClick={() => setActiveKpi('all')}
                    compact
                />
                <KpiCard
                    icon={TimerReset}
                    label="Pending"
                    value={designStats.pending_count ?? 0}
                    detail="Not yet started"
                    tone="neutral"
                    active={filters.activeKpi === 'pending'}
                    onClick={() => setActiveKpi(filters.activeKpi === 'pending' ? 'all' : 'pending')}
                    compact
                />
                <KpiCard
                    icon={RefreshCw}
                    label="In Progress"
                    value={designStats.in_progress_count ?? 0}
                    detail="Active design work"
                    tone="blue"
                    active={filters.activeKpi === 'in_progress'}
                    onClick={() => setActiveKpi(filters.activeKpi === 'in_progress' ? 'all' : 'in_progress')}
                    compact
                />
                <KpiCard
                    icon={WandSparkles}
                    label="Changes"
                    value={designStats.changes_count ?? 0}
                    detail="Revision cycles underway"
                    tone="orange"
                    active={filters.activeKpi === 'changes'}
                    onClick={() => setActiveKpi(filters.activeKpi === 'changes' ? 'all' : 'changes')}
                    compact
                />
                <KpiCard
                    icon={CheckCircle2}
                    label="Won"
                    value={designStats.won_count ?? 0}
                    detail="Approved briefs"
                    tone="green"
                    active={filters.activeKpi === 'won'}
                    onClick={() => setActiveKpi(filters.activeKpi === 'won' ? 'all' : 'won')}
                    compact
                />
                <KpiCard
                    icon={XCircle}
                    label="Lost"
                    value={designStats.lost_count ?? 0}
                    detail="Rejected or dropped"
                    tone="red"
                    active={filters.activeKpi === 'lost'}
                    onClick={() => setActiveKpi(filters.activeKpi === 'lost' ? 'all' : 'lost')}
                    compact
                />
                <KpiCard
                    icon={RefreshCw}
                    label="Open"
                    value={designStats.open_count ?? 0}
                    detail="Total minus won and lost"
                    tone="blue"
                    active={filters.activeKpi === 'open'}
                    onClick={() => setActiveKpi(filters.activeKpi === 'open' ? 'all' : 'open')}
                    compact
                />
            </div>

            <div className="premium-panel premium-panel--scroll" style={{ minHeight: 0 }}>
                {loading && tableProjects.length === 0 ? (
                    <div className="loading-row">Loading design briefs...</div>
                ) : (
                    <DesignTable
                        projects={tableProjects}
                        onUpdateStatus={handleUpdateStatus}
                        onUpdateField={handleUpdateStatus}
                    />
                )}
            </div>
        </AppShell>
    );
}
