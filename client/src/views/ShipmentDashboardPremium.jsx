import React, { useState } from 'react';
import { Truck, Package, CheckCircle, AlertTriangle, Search, X, PanelLeft, Menu, Plus, Download, FileSpreadsheet, Archive, Trash2, RefreshCw, Bell } from 'lucide-react';
import { useShipments } from '../hooks/useShipments';
import ShipmentTable from '../components/ShipmentTable';
import TrackModal from '../components/TrackModal';
import ShipmentDetailPanel from '../components/ShipmentDetailPanel';
import ShipmentSidePanel from '../components/ShipmentSidePanel';
import AppShell from '../components/app/AppShell';
import KpiCard from '../components/app/KpiCard';
import PremiumDateRangePicker from '../components/PremiumDateRangePicker';
import AlertBanner from '../components/AlertBanner';
import '../design-premium.css';

export default function ShipmentDashboardPremium() {
    const {
        shipments, stats, loading, refreshing, error, loadData, filteredShipments,
        filter, setFilter, setSearchQuery, searchQuery, setCarrierFilter, setDateFilter,
        deleteShipment, archiveShipment, batchDelete, batchArchive, importExcel, refreshTracking, exportExcel,
    } = useShipments();

    const [selectedShipment, setSelectedShipment] = useState(null);
    const [selectedIds, setSelectedIds] = useState([]);
    const [showTrack, setShowTrack] = useState(false);

    const importExcelPrompt = () => {
        const el = document.getElementById('excel-file-input');
        if (el) el.click();
    };

    const handleDelete = (id) => {
        if (window.confirm('Delete this shipment?')) deleteShipment(id);
    };

    const handleArchive = (id) => {
        archiveShipment(id);
    };

    const handleBatchDelete = () => {
        if (window.confirm(`Delete ${selectedIds.length} shipments?`)) {
            batchDelete(selectedIds);
            setSelectedIds([]);
        }
    };

    const handleBatchArchive = () => {
        batchArchive(selectedIds, true);
        setSelectedIds([]);
    };

    const resetFilters = () => {
        setFilter('All');
        setSearchQuery('');
        setCarrierFilter('All');
        setDateFilter('All');
        setSelectedShipment(null);
    };

    const hasActiveFilters = filter !== 'All' || searchQuery !== '';

    const header = ({ toggleSidebar, sidebarOverlay, sidebarOpen }) => (
        <>
            {sidebarOverlay ? (
                <button
                    type="button"
                    className="design-dashboard__sidebar-rail-btn shipping-sidebar-rail-btn"
                    onClick={toggleSidebar}
                >
                    <PanelLeft size={18} strokeWidth={2} />
                </button>
            ) : null}

            <header className="design-premium-header">
                <div className="design-premium-header__inner">
                    <div className="design-premium-header__brand design-premium-header__brand--offset">
                        <img src="/logo.jpg" alt="Insta-SCM Logo" className="design-premium-header__logo" />
                    </div>

                    <div className="design-premium-header__search-container">
                        <label className="design-premium-search">
                            <Search size={16} className="design-premium-search__icon" aria-hidden />
                            <input
                                type="search"
                                placeholder="Search ID, Exhibition..."
                                value={searchQuery || ''}
                                onChange={(event) => setSearchQuery(event.target.value)}
                            />
                        </label>
                    </div>

                    <div className="design-premium-header__filters">
                        <div className="design-premium-filter">
                            <div className="design-premium-filter__label">Date range</div>
                            <PremiumDateRangePicker />
                        </div>
                    </div>

                    <div className="design-premium-header__actions">
                        {hasActiveFilters && (
                            <button
                                type="button"
                                className="design-premium-btn design-premium-btn--danger-ghost"
                                onClick={resetFilters}
                                title="Clear all filters"
                            >
                                <X size={14} /> Clear
                            </button>
                        )}

                        <button className="design-premium-btn" onClick={importExcelPrompt} title="Import Excel">
                            <FileSpreadsheet size={15} className="design-premium-btn__icon" /> Import
                        </button>

                        <button className="design-premium-btn" onClick={exportExcel} disabled={loading} title="Export Excel">
                            <Download size={15} className="design-premium-btn__icon" /> Export
                        </button>

                        <button
                            className="design-premium-icon-btn"
                            onClick={() => { void refreshTracking(); }}
                            disabled={loading || refreshing}
                            title="Refresh Tracking"
                        >
                            <RefreshCw size={16} className={refreshing ? 'design-premium-icon-btn__spin' : ''} />
                        </button>

                        <button className="design-premium-btn design-premium-btn--primary" onClick={() => setShowTrack(true)}>
                            <Plus size={15} /> Add Shipment
                        </button>

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
            <input type="file" accept=".xlsx,.xls" className="app-hidden-input" id="excel-file-input"
                onChange={e => { const f = e.target.files[0]; if (f) importExcel(f); e.target.value = ''; }} />

            <AppShell
                activeNav="dashboard"
                header={header}
                showGlobalDate={false}
                mainClassName="premium-main--design"
                pageClassName="design-dashboard-page shipping-dashboard-page"
                sidebarOverlay
            >
                <AlertBanner message={error} />

                <div className="premium-sliding-layout premium-sliding-layout--compact">
                    <div className={`premium-sliding-main ${selectedShipment || showTrack ? 'is-shrunk' : ''}`}>
                        <div className="design-dashboard__kpi-grid">
                            <KpiCard
                                icon={Truck}
                                label="Total Shipments"
                                value={`${stats.total ?? 0}`}
                                active={filter === 'All'}
                                onClick={() => setFilter('All')}
                                className="design-dashboard__kpi design-dashboard__kpi--all"
                            />
                            <KpiCard
                                icon={Package}
                                label="In Transit"
                                value={`${stats.transit ?? 0}`}
                                tone="blue"
                                active={filter === 'Active'}
                                onClick={() => setFilter('Active')}
                                className="design-dashboard__kpi design-dashboard__kpi--pending"
                            />
                            <KpiCard
                                icon={CheckCircle}
                                label="Delivered"
                                value={`${stats.delivered ?? 0}`}
                                tone="green"
                                active={filter === 'Delivered'}
                                onClick={() => setFilter('Delivered')}
                                className="design-dashboard__kpi design-dashboard__kpi--won"
                            />
                            <KpiCard
                                icon={AlertTriangle}
                                label="Exceptions"
                                value={`${stats.exceptions ?? 0}`}
                                tone="red"
                                active={filter === 'Exception'}
                                onClick={() => setFilter('Exception')}
                                className="design-dashboard__kpi design-dashboard__kpi--lost"
                            />
                        </div>

                        <div className="design-dashboard__table-shell shipping-table-panel">
                            {loading && shipments.length === 0 ? (
                                <div className="loading-row design-dashboard__loading">Loading shipments...</div>
                            ) : (
                                <ShipmentTable
                                    shipments={filteredShipments}
                                    loading={loading}
                                    onSelectShipment={(s) => {
                                        setSelectedShipment(s);
                                        setShowTrack(false);
                                    }}
                                    onDeleteShipment={handleDelete}
                                    onArchiveShipment={handleArchive}
                                    selectedIds={selectedIds}
                                    onSelectionChange={setSelectedIds}
                                />
                            )}
                        </div>
                    </div>

                    {showTrack && (
                        <ShipmentSidePanel 
                            isOpen={true} 
                            onClose={() => setShowTrack(false)} 
                            title="Add New Shipment"
                        >
                            <TrackModal 
                                isPanel 
                                onClose={() => setShowTrack(false)} 
                                onTracked={loadData} 
                            />
                        </ShipmentSidePanel>
                    )}

                    {selectedShipment && (
                        <ShipmentSidePanel 
                            isOpen={true} 
                            onClose={() => {
                                setSelectedShipment(null);
                            }} 
                            title="Shipment Details"
                        >
                            <ShipmentDetailPanel 
                                isPanel
                                shipment={selectedShipment} 
                                onClose={() => setSelectedShipment(null)} 
                                onDeleted={loadData} 
                            />
                        </ShipmentSidePanel>
                    )}
                </div>

                    {/* Batch Actions Toolbar */}
                    {selectedIds.length > 0 && (
                        <div className="batch-toolbar shipping-batch-toolbar animate-in-up">
                            <div className="bt-info">
                                <div className="bt-count">{selectedIds.length}</div>
                                <span>shipments selected</span>
                            </div>
                            <div className="bt-actions">
                                <button className="bt-btn archive" onClick={handleBatchArchive}>
                                    <Archive size={14} /> Move to Storage
                                </button>
                                <button className="bt-btn delete" onClick={handleBatchDelete}>
                                    <Trash2 size={14} /> Delete
                                </button>
                                <button className="bt-close" onClick={() => setSelectedIds([])}>Cancel</button>
                            </div>
                        </div>
                    )}

            </AppShell>
        </>
    );
}
