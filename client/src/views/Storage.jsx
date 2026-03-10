import React, { useState, useEffect } from 'react';
import { Archive, ArrowLeft, Trash2, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useShipments } from '../hooks/useShipments';
import ShipmentTable from '../components/ShipmentTable';
import ShipmentDetailPanel from '../components/ShipmentDetailPanel';
import { useAuth } from '../contexts/AuthContext';

export default function Storage() {
    const [isDark] = useState(() => localStorage.getItem('insta_theme') === 'dark');
    const [selected, setSelected] = useState(null);
    const { user } = useAuth();
    const {
        shipments, loading, error, loadData, filteredShipments,
        deleteShipment, archiveShipment
    } = useShipments();

    // Load archived data on mount
    useEffect(() => {
        loadData(true); // true means includeArchived/onlyArchived based on my hook update
    }, [loadData]);

    const handleRefresh = () => loadData(true);

    const handleDelete = (id) => {
        if (window.confirm('Permanently delete this archived shipment?')) {
            deleteShipment(id);
        }
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

                <aside className="sidebar">
                    <div className="sidebar-logo">
                        <img src="/logo.jpg" alt="Insta-SCM Logo" style={{ width: '130px', height: 'auto' }} />
                    </div>
                    <div className="sidebar-tagline">Excellence in Exhibition Logistics</div>

                    <nav className="sidebar-nav">
                        <Link to="/" className="sidebar-item">
                            <ArrowLeft size={17} /> Back to Dashboard
                        </Link>
                        <button className="sidebar-item active">
                            <Archive size={17} /> Storage / Archive
                        </button>
                    </nav>
                </aside>

                <main className="main-content">
                    <header className="main-header">
                        <div className="header-welcome">
                            <h1>Shipment <strong>Storage</strong></h1>
                            <p className="header-role">Archived & Completed Shipments</p>
                        </div>
                        <div className="header-right">
                            <button className="icon-btn" onClick={handleRefresh} disabled={loading}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', width: 'auto', fontSize: 13, fontWeight: 600 }}>
                                <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                                Refresh
                            </button>
                        </div>
                    </header>
                    <div className="header-accent-bar" style={{ background: 'var(--tx3)' }} />

                    <div className="tracking-body">
                        <div className="tracking-header">
                            <div>
                                <h2 className="tracking-title">Stored Records</h2>
                                <p className="tracking-sub">These shipments are archived and not visible on the main dashboard.</p>
                            </div>
                        </div>

                        {error && <div className="error-banner">⚠️ {error}</div>}

                        <div className="bottom-row">
                            <div className="tracking-table-wrap">
                                {loading ? (
                                    <div className="loading-row">Loading archive…</div>
                                ) : (
                                    <ShipmentTable
                                        shipments={filteredShipments}
                                        allShipments={shipments}
                                        loading={loading}
                                        onSelectShipment={setSelected}
                                        onDeleteShipment={handleDelete}
                                        onArchiveShipment={archiveShipment} // Toggle back to active
                                        onTracked={() => loadData(true)}
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
