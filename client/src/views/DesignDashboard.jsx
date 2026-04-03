import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Archive,
    Briefcase,
    CheckCircle2,
    Layout,
    LogOut,
    Menu,
    PenTool,
    RefreshCw,
    Search,
    SlidersHorizontal,
    TrendingDown,
    TrendingUp,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDesignProjects } from '../hooks/useDesignProjects';
import DesignTable from '../components/DesignTable';
import GlobalDateRangePicker from '../components/GlobalDateRangePicker';
import { CardSkeleton } from '../components/SkeletonLoader';

export default function DesignDashboard() {
    const { user, logout } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const isDark = localStorage.getItem('insta_theme') === 'dark';

    const {
        filteredDesignProjects,
        designStats,
        loading,
        syncing,
        error,
        filterStatus,
        setFilterStatus,
        searchQuery,
        setSearchQuery,
        updateDesignStatus,
        syncCrmFeed,
        loadData,
    } = useDesignProjects();

    const statusOptions = useMemo(
        () => ['All', 'In-Process', 'Design Change', 'Drop'],
        []
    );

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

    return (
        <div className={isDark ? 'dark' : 'light'} style={{ minHeight: '100vh', background: 'var(--bg)' }}>
            <div className={`app-layout ${sidebarOpen ? '' : 'sidebar-closed'}`}>
                <aside className="sidebar">
                    <div className="sidebar-logo">
                        <img src="/logo.jpg" alt="Insta-SCM Logo" style={{ width: '130px', height: 'auto' }} />
                    </div>
                    <div className="sidebar-tagline">Excellence in Exhibition Logistics</div>

                    <nav className="sidebar-nav">
                        <Link to="/design" className="sidebar-item active">
                            <PenTool size={17} /> Design Management
                        </Link>
                        <Link to="/projects" className="sidebar-item">
                            <Briefcase size={17} /> Projects List
                        </Link>
                        <Link to="/board" className="sidebar-item">
                            <Layout size={17} /> Project Board
                        </Link>
                        <Link to="/timeline" className="sidebar-item">
                            <RefreshCw size={17} /> Resource Timeline
                        </Link>
                        <Link to="/storage" className="sidebar-item">
                            <Archive size={17} /> Storage
                        </Link>
                    </nav>
                </aside>

                <main className="main-content">
                    <header className="main-header">
                        <div className="header-welcome" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <button className="icon-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
                                <Menu size={20} />
                            </button>
                            <div>
                                <h1>Design <strong>Management</strong></h1>
                                <p className="header-role">
                                    Pre-sales CRM briefs and design-stage conversion for {user?.full_name || 'Operations'}
                                </p>
                            </div>
                        </div>

                        <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <GlobalDateRangePicker />
                            <button
                                className="icon-btn btn-animate"
                                onClick={handleSyncCrm}
                                disabled={syncing}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '6px 12px',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    background: 'var(--green)',
                                    color: 'white',
                                }}
                            >
                                <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
                                {syncing ? 'Syncing CRM...' : 'Sync CRM'}
                            </button>
                            <button
                                className="icon-btn btn-animate"
                                onClick={loadData}
                                disabled={loading}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 13, fontWeight: 600 }}
                            >
                                <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                                Refresh
                            </button>
                            <button className="icon-btn btn-animate" onClick={logout} style={{ marginLeft: '0.5rem', color: '#E53935' }}>
                                <LogOut size={16} />
                            </button>
                        </div>
                    </header>
                    <div className="header-accent-bar" />

                    <div className="tracking-body">
                        {error && <div className="error-banner">{error}</div>}

                        <div className="kpi-row kpi-row-5">
                            <div className="kpi-card">
                                <div className="kpi-left">
                                    <div className="kpi-title">Total Brief</div>
                                    <div className="kpi-value">{designStats.total_brief ?? 0}</div>
                                    <div className="kpi-sub muted">Win + in-process designs</div>
                                </div>
                                <div className="kpi-icon blue-icon"><Briefcase size={22} /></div>
                            </div>

                            <div className="kpi-card">
                                <div className="kpi-left">
                                    <div className="kpi-title">Win Rate</div>
                                    <div className="kpi-value">{designStats.win_rate ?? 0}%</div>
                                    <div className="kpi-sub green">{designStats.win_count ?? 0} successful designs</div>
                                </div>
                                <div className="kpi-icon green-icon"><TrendingUp size={22} /></div>
                            </div>

                            <div className="kpi-card">
                                <div className="kpi-left">
                                    <div className="kpi-title">Drop Rate</div>
                                    <div className="kpi-value">{designStats.drop_rate ?? 0}%</div>
                                    <div className="kpi-sub red">{designStats.drop_count ?? 0} discarded designs</div>
                                </div>
                                <div className="kpi-icon orange-icon"><TrendingDown size={22} /></div>
                            </div>

                            <div className="kpi-card active-kpi" onClick={() => setFilterStatus(filterStatus === 'Design Change' ? 'All' : 'Design Change')}>
                                <div className="kpi-left">
                                    <div className="kpi-title">Design Iterations</div>
                                    <div className="kpi-value">{designStats.design_iterations ?? 0}</div>
                                    <div className="kpi-sub orange">Status: Design Change</div>
                                </div>
                                <div className="kpi-icon purple-icon"><CheckCircle2 size={22} /></div>
                            </div>
                        </div>

                        <div className="tracking-toolbar" style={{ margin: '24px 0', display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <div className="toolbar-search" style={{ flex: 1 }}>
                                <Search size={14} className="ts-icon" />
                                <input
                                    className="ts-input"
                                    placeholder="Search by CRM ID, project name, venue, or area..."
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', border: '1px solid var(--bd)', borderRadius: 'var(--r-md)', background: 'var(--bg-card)' }}>
                                <SlidersHorizontal size={14} color="var(--tx3)" />
                                <select
                                    value={filterStatus}
                                    onChange={(event) => setFilterStatus(event.target.value)}
                                    style={{
                                        border: 'none',
                                        background: 'transparent',
                                        color: 'var(--tx)',
                                        fontWeight: 700,
                                        fontSize: '12px',
                                        outline: 'none',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {statusOptions.map((option) => (
                                        <option key={option} value={option}>
                                            {option === 'All' ? 'All Statuses' : option}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="bottom-row">
                            <div className="tracking-table-wrap" style={{ minHeight: '400px' }}>
                                {loading && filteredDesignProjects.length === 0 ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', padding: '20px' }}>
                                        <CardSkeleton />
                                        <CardSkeleton />
                                        <CardSkeleton />
                                    </div>
                                ) : (
                                    <DesignTable
                                        projects={filteredDesignProjects}
                                        onUpdateStatus={handleUpdateStatus}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
