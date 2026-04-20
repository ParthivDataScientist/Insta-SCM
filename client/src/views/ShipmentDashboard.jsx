import React, { useState } from 'react';
import { Truck, Package, CheckCircle, AlertTriangle, Search, X, PanelLeft, Menu, Plus, Download, FileSpreadsheet, Archive, Trash2, RefreshCw } from 'lucide-react';
import { useShipments } from '../hooks/useShipments';
import ShipmentTable from '../components/ShipmentTable';
import TrackModal from '../components/TrackModal';
import ShipmentDetailPanel from '../components/ShipmentDetailPanel';
import AppShell from '../components/app/AppShell';
import KpiCard from '../components/app/KpiCard';
import GlobalDateRangePicker from '../components/GlobalDateRangePicker';
import AlertBanner from '../components/AlertBanner';

export default function ShipmentDashboard() {
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

    const handleExport = async () => {
        const selected = selectedIds.filter((id) => Number.isInteger(id));
        const filteredIds = filteredShipments
            .map((shipment) => shipment?.id)
            .filter((id) => Number.isInteger(id));
        const idsToExport = selected.length > 0 ? selected : filteredIds;
        if (idsToExport.length === 0) {
            window.alert('No shipments available to export for the current selection/filter.');
            return;
        }
        await exportExcel(idsToExport);
    };

    const header = ({ toggleSidebar, sidebarOverlay, sidebarOpen }) => (
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

            <header className="design-dashboard__header">
                <div className="design-dashboard__header-scroll">
                    {!sidebarOverlay ? (
                        <button
                            type="button"
                            className="design-dashboard__icon-button mobile-only"
                            onClick={toggleSidebar}
                            title="Open navigation"
                        >
                            <Menu size={16} />
                        </button>
                    ) : null}

                    <div className="design-dashboard__header-filters">
                        <div className="design-dashboard__filter-field design-dashboard__filter-field--search">
                            <span className="design-dashboard__filter-label">Search</span>
                            <label className="design-dashboard__search">
                                <Search size={16} aria-hidden />
                                <input
                                    type="search"
                                    placeholder="Search ID, Exhibition..."
                                    value={searchQuery || ''}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                />
                            </label>
                        </div>
                        
                        <div className="design-dashboard__filter-field design-dashboard__filter-field--date">
                            <span className="design-dashboard__filter-label">Date range</span>
                            <GlobalDateRangePicker
                                compact
                                label={false}
                                className="design-dashboard__date-range projects-dashboard__date-range"
                            />
                        </div>

                        {hasActiveFilters ? (
                            <button
                                type="button"
                                className="design-dashboard__action-button projects-dashboard__reset-button"
                                onClick={resetFilters}
                                title="Clear filters"
                            >
                                <X size={15} /> Reset
                            </button>
                        ) : null}
                    </div>

                    <div className="design-dashboard__header-actions" role="group">
                        <button className="design-dashboard__action-button design-dashboard__action-button--primary" onClick={() => setShowTrack(true)}>
                            <Plus size={15} /> Add Shipment
                        </button>
                        <button className="design-dashboard__icon-button design-dashboard__icon-button--grouped design-dashboard__icon-button--text" onClick={importExcelPrompt} title="Import Excel">
                            <FileSpreadsheet size={16} className="design-dashboard__button-icon" /> Import
                        </button>
                        <button className="design-dashboard__icon-button design-dashboard__icon-button--grouped design-dashboard__icon-button--text" onClick={handleExport} disabled={loading} title="Export Excel">
                            <Download size={16} className="design-dashboard__button-icon" /> Export
                        </button>
                        <button
                            className="design-dashboard__icon-button design-dashboard__icon-button--grouped"
                            onClick={() => { void refreshTracking(); }}
                            disabled={loading || refreshing}
                            title="Refresh Tracking"
                        >
                            <RefreshCw size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                        </button>
                    </div>
                </div>
            </header>
        </>
    );

    return (
        <>
            {showTrack && <TrackModal onClose={() => setShowTrack(false)} onTracked={loadData} />}
            {selectedShipment && <ShipmentDetailPanel shipment={selectedShipment} onClose={() => setSelectedShipment(null)} onDeleted={loadData} />}

            <input type="file" accept=".xlsx,.xls" className="app-hidden-input" id="excel-file-input"
                onChange={e => { const f = e.target.files[0]; if (f) importExcel(f); e.target.value = ''; }} />

            <AppShell
                activeNav="dashboard"
                header={header}
                showGlobalDate={false}
                mainClassName="premium-main--design"
                pageClassName="design-dashboard-page"
                sidebarOverlay
            >
                <AlertBanner message={error} />

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

                <div className="design-dashboard__table-shell">
                    {loading && shipments.length === 0 ? (
                        <div className="loading-row design-dashboard__loading">Loading shipments...</div>
                    ) : (
                        <ShipmentTable
                            shipments={filteredShipments}
                            loading={loading}
                            onSelectShipment={setSelectedShipment}
                            onDeleteShipment={handleDelete}
                            onArchiveShipment={handleArchive}
                            selectedIds={selectedIds}
                            onSelectionChange={setSelectedIds}
                        />
                    )}

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
                </div>
            </AppShell>
        </>
    );
}
