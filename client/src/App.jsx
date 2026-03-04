import React, { useState, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import {
    Package, Truck, CheckCircle, AlertTriangle,
    Bell, Search, RefreshCw, ChevronRight, Plus, ArrowUpRight, Trash2, FileSpreadsheet, LogOut
} from 'lucide-react';
import { useShipments } from './hooks/useShipments';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import TrackModal from './components/TrackModal';
import ShipmentDetailPanel from './components/ShipmentDetailPanel';
import Login from './views/Login';
import Register from './views/Register';
import './styles.css';

/* ── iNSTa Logo SVG ── */
const Logo = () => (
    <svg width="130" height="50" viewBox="0 0 130 50" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="iNSTa Exhibition">
        {[9, 24, 31, 38, 50, 57, 70, 77, 91, 98].map(x => (
            <g key={x}>
                <line x1={x} y1="0" x2={x} y2="11" stroke="rgba(255,255,255,0.28)" strokeWidth="0.8" />
                <circle cx={x} cy="0" r="1.1" fill="rgba(255,255,255,0.25)" />
            </g>
        ))}
        <text x="3" y="38" fontFamily="'Montserrat','Inter',sans-serif" fontWeight="900" fontSize="27" fill="#E53935" fontStyle="italic">i</text>
        <text x="16" y="38" fontFamily="'Montserrat','Inter',sans-serif" fontWeight="900" fontSize="27" fill="#FFFFFF">N</text>
        <text x="38" y="38" fontFamily="'Montserrat','Inter',sans-serif" fontWeight="900" fontSize="27" fill="#FFFFFF">S</text>
        <text x="59" y="38" fontFamily="'Montserrat','Inter',sans-serif" fontWeight="900" fontSize="27" fill="#FFFFFF">T</text>
        <text x="78" y="38" fontFamily="'Montserrat','Inter',sans-serif" fontWeight="900" fontSize="27" fill="#E53935" fontStyle="italic">a</text>
        <text x="3" y="48" fontFamily="'Inter',sans-serif" fontWeight="600" fontSize="6.5" fill="rgba(255,255,255,0.35)" letterSpacing="1.8">EXHIBITION</text>
    </svg>
);

/* ── Helpers ── */
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
    const [isDark, setIsDark] = useState(false);
    const [selected, setSelected] = useState(null);
    const [showTrack, setShowTrack] = useState(false);
    const [hdrSearch, setHdrSearch] = useState('');
    const { user, logout } = useAuth();

    const {
        shipments, stats, loading, error, loadData, filteredShipments,
        filter, setFilter, setSearchQuery, setCarrierFilter, setDateFilter,
        deleteShipment, importExcel,
    } = useShipments();

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
                        <div className="header-search-bar">
                            <Search size={14} className="search-icon" />
                            <input className="header-search-input" placeholder="Search Shipment, Tracking ID..."
                                value={hdrSearch} onChange={e => setHdrSearch(e.target.value)} />
                        </div>
                        <div className="header-right">
                            <button className="icon-btn" onClick={loadData} title="Refresh data"><RefreshCw size={16} /></button>
                            <button className="icon-btn">
                                <Bell size={16} />
                                {stats.exceptions > 0 && <span className="notif-badge">{stats.exceptions}</span>}
                            </button>
                            <div className="theme-switch">
                                <span className={!isDark ? 'ts-label active' : 'ts-label'}>Light</span>
                                <button className="ts-track" onClick={() => setIsDark(!isDark)}>
                                    <div className="ts-thumb" />
                                </button>
                                <span className={isDark ? 'ts-label active' : 'ts-label'}>Dark</span>
                            </div>
                            <button className="icon-btn" onClick={logout} title="Logout" style={{ marginLeft: '1rem', color: '#E53935' }}>
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
                                        {stats.delivered > 0 ? `${stats.delivered} delivered` : 'Track your first'}
                                    </div>
                                </div>
                                <div className="kpi-icon red-icon"><Truck size={22} /></div>
                            </div>

                            <div className="kpi-card">
                                <div className="kpi-left">
                                    <div className="kpi-title">In Transit</div>
                                    <div className="kpi-value">{stats.transit ?? 0}</div>
                                    <div className={`kpi-sub ${stats.exceptions > 0 ? 'orange' : 'muted'}`}>
                                        {stats.exceptions > 0 ? `${stats.exceptions} delayed` : 'On schedule'}
                                    </div>
                                </div>
                                <div className="kpi-icon orange-icon"><Package size={22} /></div>
                            </div>

                            <div className="kpi-card">
                                <div className="kpi-left">
                                    <div className="kpi-title">Delivered</div>
                                    <div className="kpi-value">{stats.delivered ?? 0}</div>
                                    <div className="kpi-sub green">
                                        {stats.total > 0 ? `${Math.round((stats.delivered / stats.total) * 100)}% success` : '—'}
                                    </div>
                                </div>
                                <div className="kpi-icon green-icon"><CheckCircle size={22} /></div>
                            </div>

                            <div className="kpi-card">
                                <div className="kpi-left">
                                    <div className="kpi-title">Exceptions</div>
                                    <div className="kpi-value">{stats.exceptions ?? 0}</div>
                                    <div className={`kpi-sub ${stats.exceptions > 0 ? 'red' : 'muted'}`}>
                                        {stats.exceptions > 0 ? 'Needs attention' : 'All clear'}
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
                                <button className="btn-outline-sm" onClick={importExcelPrompt}>
                                    <FileSpreadsheet size={14} /> Import Excel
                                </button>
                            </div>
                        </div>

                        {error && <div className="error-banner">⚠️ {error}. Make sure backend is running on port 8001.</div>}

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
                                <input className="ts-input" placeholder="Search tracking ID, name, carrier…"
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
                                            <table className="tracking-table">
                                                <thead>
                                                    <tr>
                                                        <th>Tracking ID / Name</th>
                                                        <th>Status</th>
                                                        <th>Current Status</th>
                                                        <th>Carrier</th>
                                                        <th>Route</th>
                                                        <th>ETA</th>
                                                        <th>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredShipments.map(s => (
                                                        <tr key={s.id} onClick={() => setSelected(s)}>
                                                            <td>
                                                                <div className="tid-cell">
                                                                    <div className="tid-icon"><Package size={14} /></div>
                                                                    <div>
                                                                        <div className="tid-name">{s.items && s.items !== 'Package' ? s.items : (s.recipient || 'Shipment')}</div>
                                                                        <div className="tid-num">{s.tracking_number}</div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td><span className={`status-pill ${classify(s.status)}`}>{statusLabel(s.status)}</span></td>
                                                            <td className="current-status-cell">
                                                                <div className="cs-text" title={s.history && s.history.length > 0 ? s.history[0].description : s.status}>
                                                                    {s.history && s.history.length > 0 ? s.history[0].description : s.status}
                                                                </div>
                                                            </td>
                                                            <td className="carrier-cell">{s.carrier || '—'}</td>
                                                            <td>
                                                                {s.origin
                                                                    ? <div className="route-mini">
                                                                        <span className="rm-label">FROM </span>{city(s.origin)}<br />
                                                                        <span className="rm-label">TO </span>{city(s.destination)}
                                                                    </div>
                                                                    : '—'}
                                                            </td>
                                                            <td className="eta-cell">{s.eta || '—'}</td>
                                                            <td className="action-cell" onClick={e => e.stopPropagation()}>
                                                                <button className="track-btn" onClick={() => setSelected(s)}>Track</button>
                                                                <button className="delete-btn" onClick={e => handleDelete(e, s.id)} title="Delete shipment">
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
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
                    <Route path="/*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}
