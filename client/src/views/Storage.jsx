import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
    Archive, Truck, AlertTriangle, ChevronRight, ArrowLeft, RefreshCw, Trash2, Briefcase, Layout
} from 'lucide-react';
import { useShipments } from '../hooks/useShipments';
import { useAuth } from '../contexts/AuthContext';
import ShipmentTable from '../components/ShipmentTable';
import ShipmentDetailPanel from '../components/ShipmentDetailPanel';
import '../styles.css';

export default function Storage() {
    const [isDark] = useState(() => localStorage.getItem('insta_theme') === 'dark');
    const [selected, setSelected] = useState(null);
    const [selectedIds, setSelectedIds] = useState([]);
    const { user } = useAuth();
    const {
        shipments, loading, error, loadData, filteredShipments,
        deleteShipment, archiveShipment, batchDelete, batchArchive
    } = useShipments();

    // Load archived data on mount
    useEffect(() => {
        loadData(true);
    }, [loadData]);

    const handleRefresh = () => {
        loadData(true);
    };

    const handleDelete = (id) => {
        if (window.confirm('Permanently delete this archived shipment?')) {
            deleteShipment(id);
        }
    };

    const handleBatchDelete = () => {
        if (window.confirm(`Permanently delete ${selectedIds.length} archived shipments?`)) {
            batchDelete(selectedIds);
            setSelectedIds([]);
        }
    };

    const handleBatchRestore = () => {
        batchArchive(selectedIds, false);
        setSelectedIds([]);
    };

    return (
        <div className={isDark ? 'dark' : 'light'} style={{ minHeight: '100vh', background: 'var(--bg)' }}>
            <div className="app-layout">
                
                {selected && (
                    <ShipmentDetailPanel 
                        shipment={selected} 
                        onClose={() => setSelected(null)} 
                        onDeleted={() => loadData(true)} 
                    />
                )}

                {/* ═══════ SIDEBAR ═══════ */}
                <aside className="sidebar">
                    <div className="sidebar-logo">
                        <img src="/logo.jpg" alt="Insta-SCM Logo" style={{ width: '130px', height: 'auto' }} />
                    </div>
                    <div className="sidebar-tagline">Excellence in Exhibition Logistics</div>

                    <nav className="sidebar-nav">
                        <Link to="/projects" className="sidebar-item">
                            <Briefcase size={17} /> Projects List
                        </Link>
                        <Link to="/board" className="sidebar-item">
                            <Layout size={17} /> Project Board
                        </Link>
                        <Link to="/timeline" className="sidebar-item">
                            <RefreshCw size={17} /> Resource Timeline
                        </Link>
                        <Link to="/dashboard" className="sidebar-item">
                            <Truck size={17} /> Shipment Tracking
                        </Link>
                        <a className="sidebar-item active">
                            <Archive size={17} /> Storage
                        </a>
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Link to="/" className="icon-btn" title="Back to Dashboard">
                                    <ArrowLeft size={18} />
                                </Link>
                                <div>
                                    <h1>Shipment <strong>Storage</strong></h1>
                                    <p className="header-role">Archived &amp; Historical Shipments</p>
                                </div>
                            </div>
                        </div>
                        <div className="header-right">
                            <button className="icon-btn" onClick={handleRefresh} title="Refresh archive" disabled={loading}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', width: 'auto', fontSize: 13, fontWeight: 600 }}>
                                <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                                Refresh
                            </button>
                        </div>
                    </header>
                    <div className="header-accent-bar" style={{ background: 'var(--tx3)', opacity: 0.3 }} />

                    <div className="tracking-body">
                        <div className="tracking-header">
                            <div>
                                <h2 className="tracking-title">Archived Shipments</h2>
                                <p className="tracking-sub">View and manage shipments moved to storage</p>
                            </div>
                        </div>

                        {error && <div className="error-banner">⚠️ {error}</div>}

                        <div className="bottom-row">
                            <div className="tracking-table-wrap">
                                {loading ? (
                                    <div className="loading-row">Loading archive...</div>
                                ) : filteredShipments.length === 0 ? (
                                    <div className="empty-row">Your storage is currently empty.</div>
                                ) : (
                                    <ShipmentTable
                                        shipments={filteredShipments}
                                        allShipments={shipments}
                                        loading={loading}
                                        onSelectShipment={setSelected}
                                        onDeleteShipment={handleDelete}
                                        onArchiveShipment={archiveShipment} // Toggle back to active
                                        onTracked={() => loadData(true)}
                                        selectedIds={selectedIds}
                                        onSelectionChange={setSelectedIds}
                                    />
                                )}
                            </div>

                            {/* Batch Actions Toolbar */}
                            {selectedIds.length > 0 && (
                                <div className="batch-toolbar animate-in-up">
                                    <div className="bt-info">
                                        <div className="bt-count">{selectedIds.length}</div>
                                        <span>shipments selected</span>
                                    </div>
                                    <div className="bt-actions">
                                        <button className="bt-btn archive" onClick={handleBatchRestore}>
                                            <Archive size={14} /> Restore to Dashboard
                                        </button>
                                        <button className="bt-btn delete" onClick={handleBatchDelete}>
                                            <Trash2 size={14} /> Delete Permanently
                                        </button>
                                        <button className="bt-close" onClick={() => setSelectedIds([])}>Cancel</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
