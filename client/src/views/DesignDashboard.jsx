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
        clients,
        cityOptions,
        setSearchQuery,
        setFilterStatus,
        setClientId,
        setCity,
        setDateField,
        setActiveKpi,
        clearFilters,
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
        <div className="premium-filter" style={{ minWidth: '320px', flex: 1 }}>
            <Search size={15} color="var(--tx3)" />
            <input
                placeholder="Search project, client, or AWB"
                value={filters.search}
                onChange={(event) => setSearchQuery(event.target.value)}
            />
        </div>
    );

    const filtersRow = (
        <div className="premium-filter-group">
            <div className="premium-filter" style={{ minWidth: '170px' }}>
                <select value={filters.status} onChange={(event) => setFilterStatus(event.target.value)}>
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="changes">Changes</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                </select>
            </div>

            <div className="premium-filter" style={{ minWidth: '170px' }}>
                <select value={filters.clientId} onChange={(event) => setClientId(event.target.value)}>
                    <option value="all">All Clients</option>
                    {clients.map((client) => (
                        <option key={client.id} value={String(client.id)}>{client.name}</option>
                    ))}
                </select>
            </div>

            <div className="premium-filter" style={{ minWidth: '150px' }}>
                <select value={filters.city} onChange={(event) => setCity(event.target.value)}>
                    <option value="all">All Cities</option>
                    {cityOptions.filter((city) => city !== 'all').map((city) => (
                        <option key={city} value={city}>{city}</option>
                    ))}
                </select>
            </div>

            <div className="premium-filter" style={{ minWidth: '150px' }}>
                <select value={filters.dateField} onChange={(event) => setDateField(event.target.value)}>
                    <option value="show">Show Date</option>
                    <option value="booking">Booking Date</option>
                </select>
            </div>

            <button type="button" className="premium-action-button" onClick={clearFilters}>
                Reset
            </button>
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
            title="Design Dashboard"
            subtitle="Premium brief tracking with canonical KPI logic, revision history, and AWB-linked search."
            headerCenter={headerSearch}
            actions={shellActions}
            toolbar={filtersRow}
        >
            {error ? <div className="error-banner">{error}</div> : null}

            <div className="premium-kpi-grid">
                <KpiCard
                    icon={Briefcase}
                    label="Total Brief"
                    value={designStats.total_brief ?? 0}
                    detail="All briefs after current filters"
                    active={filters.activeKpi === 'all'}
                    onClick={() => setActiveKpi('all')}
                />
                <KpiCard
                    icon={TimerReset}
                    label="Pending"
                    value={designStats.pending_count ?? 0}
                    detail="Not yet started"
                    tone="neutral"
                    active={filters.activeKpi === 'pending'}
                    onClick={() => setActiveKpi(filters.activeKpi === 'pending' ? 'all' : 'pending')}
                />
                <KpiCard
                    icon={RefreshCw}
                    label="In Progress"
                    value={designStats.in_progress_count ?? 0}
                    detail="Active design work"
                    tone="blue"
                    active={filters.activeKpi === 'in_progress'}
                    onClick={() => setActiveKpi(filters.activeKpi === 'in_progress' ? 'all' : 'in_progress')}
                />
                <KpiCard
                    icon={WandSparkles}
                    label="Changes"
                    value={designStats.changes_count ?? 0}
                    detail="Revision cycles underway"
                    tone="orange"
                    active={filters.activeKpi === 'changes'}
                    onClick={() => setActiveKpi(filters.activeKpi === 'changes' ? 'all' : 'changes')}
                />
                <KpiCard
                    icon={CheckCircle2}
                    label="Won"
                    value={designStats.won_count ?? 0}
                    detail="Approved briefs"
                    tone="green"
                    active={filters.activeKpi === 'won'}
                    onClick={() => setActiveKpi(filters.activeKpi === 'won' ? 'all' : 'won')}
                />
                <KpiCard
                    icon={XCircle}
                    label="Lost"
                    value={designStats.lost_count ?? 0}
                    detail="Rejected or dropped"
                    tone="red"
                    active={filters.activeKpi === 'lost'}
                    onClick={() => setActiveKpi(filters.activeKpi === 'lost' ? 'all' : 'lost')}
                />
                <KpiCard
                    icon={RefreshCw}
                    label="Open"
                    value={designStats.open_count ?? 0}
                    detail="Total minus won and lost"
                    tone="blue"
                    active={filters.activeKpi === 'open'}
                    onClick={() => setActiveKpi(filters.activeKpi === 'open' ? 'all' : 'open')}
                />
            </div>

            <div className="premium-panel" style={{ minHeight: '420px', overflow: 'auto' }}>
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
