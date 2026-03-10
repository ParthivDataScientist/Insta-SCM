import React, { useState, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import {
    Package, Truck, CheckCircle, AlertTriangle, Search,
    RefreshCw, ChevronRight, Plus, ArrowUpRight, FileSpreadsheet, LogOut, Archive, Download
} from 'lucide-react';
import { useShipments } from './hooks/useShipments';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ShipmentTable from './components/ShipmentTable';
import TrackModal from './components/TrackModal';
import ShipmentDetailPanel from './components/ShipmentDetailPanel';
import Login from './views/Login';
import Register from './views/Register';
import Storage from './views/Storage';
import './styles.css';

/* ── iNSTa Logo SVG ── */
const Logo = () => (
    <img src="/logo.jpg" alt="Insta-SCM Logo" style={{ width: '130px', height: 'auto' }} />
);

/* ── Helpers ── */
const formatDate = (dateStr) => {
    if (!dateStr || dateStr === 'TBD' || dateStr === '—') return dateStr;
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric',
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true
        });
    } catch (e) {
        return dateStr;
    }
};

const classify = (s = '') => {
    const v = s.toLowerCase();
    if (v.includes('delivered')) return 'delivered';
    if (v.includes('transit')) return 'transit';
    if (v.includes('out for')) return 'ofd';
    if (v.includes('exception')) return 'exception';
    return 'unknown';
};
const statusLabel = (s = '') => {
    const v = s.toLowerCase();
    if (v.includes('delivered')) return 'Delivered';
    if (v.includes('transit')) return 'In Transit';
    if (v.includes('out for')) return 'Out for Delivery';
    if (v.includes('exception')) return 'Delayed';
    return s || 'Unknown';
};
const city = (loc = '') => (loc || '').split(',')[0].trim() || '—';

/* ─────────────────────────────────────────────────────────────
   DASHBOARD — Main tracking view
───────────────────────────────────────────────────────────── */
function Dashboard() {
    const [isDark, setIsDark] = useState(() => localStorage.getItem('insta_theme') === 'dark');
    
    const toggleTheme = () => {
        const newTheme = !isDark;
        setIsDark(newTheme);
        localStorage.setItem('insta_theme', newTheme ? 'dark' : 'light');
    };
    const [selected, setSelected] = useState(null);
    const [showTrack, setShowTrack] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);
    const { user, logout } = useAuth();

    const {
        shipments, stats, loading, error, loadData, filteredShipments,
        filter, setFilter, setSearchQuery, setCarrierFilter, setDateFilter,
        deleteShipment, archiveShipment, importExcel, exportExcel,
    } = useShipments();

    const handleRefresh = async () => {
        await loadData();
        setLastUpdated(new Date());
    };

    const importExcelPrompt = () => {
        const el = document.getElementById('excel-file-input');
        if (el) el.click();
    };

    const alerts = useMemo(
        () => shipments.filter(s => classify(s.status) === 'exception').slice(0, 3),
        [shipments]
    );

    const handleDelete = (e, id) => {
        e.stopPropagation();
        if (window.confirm('Delete this shipment?')) deleteShipment(id);
    };

    const handleArchive = (id) => {
        archiveShipment(id);
    };

    return (
        <div className={isDark ? 'dark' : 'light'} style={{ minHeight: '100vh', background: 'var(--bg)' }}>
            <div className="app-layout">

                {/* Modals */}
                {showTrack && <TrackModal onClose={() => setShowTrack(false)} onTracked={loadData} />}
                {selected && <ShipmentDetailPanel shipment={selected} onClose={() => setSelected(null)} onDeleted={loadData} />}

                {/* Hidden file input for Excel import */}
                <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} id="excel-file-input"
                    onChange={e => { const f = e.target.files[0]; if (f) importExcel(f); e.target.value = ''; }} />

                {/* ═══════ SIDEBAR ═══════ */}
                <aside className="sidebar">
                    <div className="sidebar-logo"><Logo /></div>
                    <div className="sidebar-tagline">Excellence in Exhibition Logistics</div>

                    <nav className="sidebar-nav">
                        <button className="sidebar-item active">
                            <Truck size={17} /> Shipment Tracking
                        </button>
                        <Link to="/storage" className="sidebar-item">
                            <Archive size={17} /> Storage
                        </Link>
                    </nav>
                    
                    <div className="sidebar-footer-area">
                        <a href="mailto:kalyan.karande@insta-group.com" className="sidebar-footer-support">
                            <div className="sf-icon"><AlertTriangle size={13} /></div>
                            <div>
                                <div className="sf-label">Help &amp; Support</div>
                                <div className="sf-sub">kalyan.karande@insta-group.com</div>
                            </div>
                            <ChevronRight size={13} className="sf-arrow" />
                        </a>
                    </div>
                </aside>

                {/* ═══════ MAIN ═══════ */}
                <main className="main-content">

                    {/* Header */}
                    <header className="main-header">
                        <div className="header-welcome">
                            <h1>Welcome, <strong>{user?.full_name || 'Operations Manager'}</strong></h1>
                            <p className="header-role">Insta Exhibition SCM — Shipment Tracking</p>
                        </div>
                        <div className="header-right">
                            {lastUpdated && (
                                <span style={{ fontSize: 12, color: 'var(--tx3)', whiteSpace: 'nowrap' }}>
                                    Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                            <button className="icon-btn" onClick={handleRefresh} title="Refresh tracking data" disabled={loading}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', width: 'auto', fontSize: 13, fontWeight: 600 }}>
                                <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                                Refresh
                            </button>
                            <div className="theme-switch">
                                <span className={!isDark ? 'ts-label active' : 'ts-label'}>Light</span>
                                <button className="ts-track" onClick={toggleTheme}>
                                    <div className="ts-thumb" />
                                </button>
                                <span className={isDark ? 'ts-label active' : 'ts-label'}>Dark</span>
                            </div>
                            <button className="icon-btn" onClick={logout} title="Logout" style={{ marginLeft: '0.5rem', color: '#E53935' }}>
                                <LogOut size={16} />
                            </button>
                        </div>
                    </header>
                    <div className="header-accent-bar" />

                    {/* ═══════ TRACKING BODY ═══════ */}
                    <div className="tracking-body">

                        {/* ── KPI Cards ── */}
                        <div className="kpi-row">
                            <div className="kpi-card">
                                <div className="kpi-left">
                                    <div className="kpi-title">Active Shipments</div>
                                    <div className="kpi-value">{stats.total ?? 0}</div>
                                    <div className="kpi-sub green">
                                        <ArrowUpRight size={12} />
                                        {stats.child_stats?.total > 0 ? (
                                            <span>
                                                {stats.total} Master • {stats.child_stats.total} Child pieces
                                            </span>
                                        ) : (
                                            stats.delivered > 0 ? `${stats.delivered} delivered` : 'Track your first'
                                        )}
                                    </div>
                                </div>
                                <div className="kpi-icon red-icon"><Truck size={22} /></div>
                            </div>

                            <div className="kpi-card">
                                <div className="kpi-left">
                                    <div className="kpi-title">In Transit</div>
                                    <div className="kpi-value">{stats.transit ?? 0}</div>
                                    <div className={`kpi-sub ${stats.exceptions > 0 || stats.child_stats?.exceptions > 0 ? 'orange' : 'muted'}`}>
                                        {stats.child_stats?.transit > 0 ? (
                                            <span>
                                                {stats.transit} Master • {stats.child_stats.transit} Child in transit
                                            </span>
                                        ) : (
                                            stats.exceptions > 0 ? `${stats.exceptions} delayed` : 'On schedule'
                                        )}
                                    </div>
                                </div>
                                <div className="kpi-icon orange-icon"><Package size={22} /></div>
                            </div>

                            <div className="kpi-card">
                                <div className="kpi-left">
                                    <div className="kpi-title">Delivered</div>
                                    <div className="kpi-value">{stats.delivered ?? 0}</div>
                                    <div className="kpi-sub green">
                                        {stats.child_stats?.delivered > 0 ? (
                                            <span>
                                                {stats.delivered} Master • {stats.child_stats.delivered} Child delivered
                                            </span>
                                        ) : (
                                            stats.total > 0 ? `${Math.round((stats.delivered / stats.total) * 100)}% success` : '—'
                                        )}
                                    </div>
                                </div>
                                <div className="kpi-icon green-icon"><CheckCircle size={22} /></div>
                            </div>

                            <div className="kpi-card">
                                <div className="kpi-left">
                                    <div className="kpi-title">Exceptions</div>
                                    <div className="kpi-value">{stats.exceptions ?? 0}</div>
                                    <div className={`kpi-sub ${stats.exceptions > 0 || stats.child_stats?.exceptions > 0 ? 'red' : 'muted'}`}>
                                        {stats.child_stats?.exceptions > 0 ? (
                                            <span>
                                                {stats.exceptions} Master • {stats.child_stats.exceptions} Child exceptions
                                            </span>
                                        ) : (
                                            stats.exceptions > 0 ? 'Needs attention' : 'All clear'
                                        )}
                                    </div>
                                </div>
                                <div className="kpi-icon red-icon"><AlertTriangle size={22} /></div>
                            </div>
                        </div>

                        {/* ── Action Bar: Title + Buttons ── */}
                        <div className="tracking-header">
                            <div>
                                <h2 className="tracking-title">Shipment Tracking</h2>
                                <p className="tracking-sub">Monitor and manage all your active shipments</p>
                            </div>
                            <div className="tracking-actions">
                                <button className="btn-primary-sm" onClick={() => setShowTrack(true)}>
                                    <Plus size={14} /> Add Shipment
                                </button>
                                <button 
                                    className="btn-outline-sm" 
                                    onClick={importExcelPrompt}
                                    title="Required: tracking_number. Optional: exhibition_name, recipient, show_date, items/name"
                                >
                                    <FileSpreadsheet size={14} /> Import Excel
                                </button>
                                <button className="btn-outline-sm" onClick={exportExcel} disabled={loading}>
                                    <Download size={14} /> Export Excel
                                </button>
                            </div>
                        </div>

                        {error && <div className="error-banner">⚠️ {error}</div>}

                        {/* ── Filters Toolbar ── */}
                        <div className="tracking-toolbar">
                            <div className="filter-tabs-row">
                                {['All', 'Active', 'Delivered', 'Exception'].map(f => (
                                    <button key={f} className={`ftab${filter === f ? ' active' : ''}`}
                                        onClick={() => setFilter(f)}>
                                        {f}
                                    </button>
                                ))}
                            </div>
                            <div className="toolbar-search">
                                <Search size={14} className="ts-icon" />
                                <input className="ts-input" placeholder="Search Exhibition, ID, Recipient..."
                                    onChange={e => setSearchQuery(e.target.value)} />
                            </div>
                            <div className="toolbar-selects">
                                <select className="tselect" onChange={e => setCarrierFilter(e.target.value)}>
                                    <option value="All">All Carriers</option>
                                    <option value="FedEx">FedEx</option>
                                    <option value="DHL">DHL</option>
                                    <option value="UPS">UPS</option>
                                </select>
                                <select className="tselect" onChange={e => setDateFilter(e.target.value)}>
                                    <option value="All">All Time</option>
                                    <option value="Today">Today</option>
                                    <option value="Last 7 Days">Last 7 Days</option>
                                </select>
                            </div>
                        </div>

                        {/* ── Main Content Row: Table + Alerts ── */}
                        <div className="bottom-row">

                            {/* Shipments Table */}
                            <div className="tracking-table-wrap">
                                {loading
                                    ? <div className="loading-row">Loading shipments…</div>
                                    : filteredShipments.length === 0
                                        ? <div className="empty-row">No shipments found. Click "Add Shipment" to start tracking.</div>
                                        : (
                                            <ShipmentTable
                                                shipments={filteredShipments}
                                                allShipments={shipments}
                                                loading={loading}
                                                onSelectShipment={setSelected}
                                                onDeleteShipment={(id) => handleDelete(new Event('click'), id)}
                                                onArchiveShipment={handleArchive}
                                                onTracked={loadData}
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

const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth();
    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
    if (!user) return <Navigate to="/login" />;
    return children;
};

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/storage" element={<ProtectedRoute><Storage /></ProtectedRoute>} />
                    <Route path="/*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}
