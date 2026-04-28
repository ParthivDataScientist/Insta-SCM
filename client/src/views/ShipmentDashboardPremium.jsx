import React, { useEffect, useState } from 'react';
import { Search, X, PanelLeft, Menu, Plus, Download, FileSpreadsheet, RefreshCw, Bell, MoreHorizontal } from 'lucide-react';
import { useShipments } from '../shipping/hooks/useShipments';
import { useShipmentSelection } from '../shipping/hooks/useShipmentSelection';
import ShipmentTable from '../shipping/components/ShipmentTable';
import TrackModal from '../shipping/components/TrackModal';
import ShipmentDetailPanel from '../shipping/components/ShipmentDetailPanel';
import ShipmentSidePanel from '../shipping/components/ShipmentSidePanel';
import ShipmentBulkActions from '../shipping/components/ShipmentBulkActions';
import ShipmentKpiCards from '../shipping/components/ShipmentKpiCards';
import AppShell from '../components/app/AppShell';
import PremiumDateRangePicker from '../components/PremiumDateRangePicker';
import AlertBanner from '../components/AlertBanner';
import '../design-premium.css';

export default function ShipmentDashboardPremium() {
    const {
        shipments, stats, loading, refreshing, error, success, loadData, filteredShipments,
        filter, setFilter, setSearchQuery, searchQuery, setCarrierFilter, setDateFilter,
        deleteShipment, archiveShipment, batchDelete, batchArchive, importExcel, refreshTracking, exportExcel,
    } = useShipments();

    const [selectedShipment, setSelectedShipment] = useState(null);
    const { selectedIds, setSelectedIds, clearSelection } = useShipmentSelection();
    const [showTrack, setShowTrack] = useState(false);
    const [showMobileHeaderActions, setShowMobileHeaderActions] = useState(false);
    const [isMobileViewport, setIsMobileViewport] = useState(() => (
        typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false
    ));

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const media = window.matchMedia('(max-width: 767px)');
        const sync = () => setIsMobileViewport(media.matches);
        sync();
        media.addEventListener('change', sync);
        return () => media.removeEventListener('change', sync);
    }, []);

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

    const handleBatchDelete = async () => {
        if (window.confirm(`Delete ${selectedIds.length} shipment(s)? This cannot be undone.`)) {
            await batchDelete(selectedIds);
            clearSelection();
        }
    };

    const handleBatchArchive = () => {
        batchArchive(selectedIds, true);
        clearSelection();
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
                    className="design-dashboard__sidebar-rail-btn shipping-sidebar-rail-btn"
                    onClick={toggleSidebar}
                >
                    <PanelLeft size={18} strokeWidth={2} />
                </button>
            ) : null}

            {isMobileViewport ? (
                <header className="design-premium-header shipping-dashboard-header shipping-dashboard-header--mobile">
                    <div className="design-premium-header__inner shipping-dashboard-header__inner shipping-mobile-header-shell">
                        <div className="shipping-mobile-topbar">
                            <button
                                type="button"
                                className="shipping-mobile-topbar__icon"
                                onClick={toggleSidebar}
                                title="Open navigation"
                                aria-label="Open navigation"
                            >
                                <Menu size={18} />
                            </button>
                            <div className="shipping-mobile-topbar__title">Shipments</div>
                            <button type="button" className="shipping-mobile-topbar__icon" title="Notifications" aria-label="Notifications">
                                <Bell size={18} />
                            </button>
                        </div>

                        <div className="shipping-mobile-search-row">
                            <label className="design-premium-search shipping-dashboard-search shipping-dashboard-search--mobile">
                                <Search size={16} className="design-premium-search__icon" aria-hidden />
                                <input
                                    type="search"
                                    placeholder="Search ID, Exhibition..."
                                    value={searchQuery || ''}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                />
                            </label>
                            <button
                                type="button"
                                className="shipping-mobile-topbar__icon shipping-mobile-topbar__icon--actions"
                                onClick={() => setShowMobileHeaderActions(true)}
                                title="More actions"
                                aria-label="More actions"
                            >
                                <MoreHorizontal size={18} />
                            </button>
                        </div>
                    </div>
                </header>
            ) : (
                <header className="design-premium-header shipping-dashboard-header">
                    <div className="design-premium-header__inner shipping-dashboard-header__inner">
                        <div className="design-premium-header__brand design-premium-header__brand--offset">
                            <img src="/logo.jpg" alt="Insta-SCM Logo" className="design-premium-header__logo" />
                        </div>

                        <div className="design-premium-header__search-container">
                            <label className="design-premium-search shipping-dashboard-search">
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

                            <button className="design-premium-btn" onClick={handleExport} disabled={loading} title="Export Excel">
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
            )}
        </>
    );

    const mobileHeaderActionSheet = showMobileHeaderActions ? (
        <>
            <button
                type="button"
                className="shipping-mobile-sheet-backdrop"
                aria-label="Close quick actions"
                onClick={() => setShowMobileHeaderActions(false)}
            />
            <section className="shipping-mobile-sheet shipping-mobile-sheet--actions" role="dialog" aria-modal="true" aria-label="Quick actions">
                <div className="shipping-mobile-sheet__header">
                    <h3>Quick Actions</h3>
                    <button type="button" className="shipping-mobile-sheet__close" onClick={() => setShowMobileHeaderActions(false)}>
                        <X size={18} />
                    </button>
                </div>
                <div className="shipping-mobile-sheet__body">
                    <button
                        type="button"
                        className="shipping-mobile-action shipping-mobile-action--primary"
                        onClick={() => {
                            setShowTrack(true);
                            setShowMobileHeaderActions(false);
                        }}
                    >
                        <Plus size={16} /> Add Shipment
                    </button>
                    <button
                        type="button"
                        className="shipping-mobile-action"
                        onClick={() => {
                            importExcelPrompt();
                            setShowMobileHeaderActions(false);
                        }}
                    >
                        <FileSpreadsheet size={16} /> Import Excel
                    </button>
                    <button
                        type="button"
                        className="shipping-mobile-action"
                        onClick={async () => {
                            await handleExport();
                            setShowMobileHeaderActions(false);
                        }}
                    >
                        <Download size={16} /> Export Excel
                    </button>
                    <button
                        type="button"
                        className="shipping-mobile-action"
                        disabled={loading || refreshing}
                        onClick={async () => {
                            await refreshTracking();
                            setShowMobileHeaderActions(false);
                        }}
                    >
                        <RefreshCw size={16} className={refreshing ? 'design-premium-icon-btn__spin' : ''} /> Refresh Tracking
                    </button>
                    {hasActiveFilters ? (
                        <button
                            type="button"
                            className="shipping-mobile-action shipping-mobile-action--danger"
                            onClick={() => {
                                resetFilters();
                                setShowMobileHeaderActions(false);
                            }}
                        >
                            <X size={16} /> Clear Filters
                        </button>
                    ) : null}
                </div>
            </section>
        </>
    ) : null;

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
                <AlertBanner message={success} type="success" />

                <div className="premium-sliding-layout premium-sliding-layout--compact">
                    <div className={`premium-sliding-main ${selectedShipment || showTrack ? 'is-shrunk' : ''}`}>
                        <ShipmentKpiCards filter={filter} onFilterChange={setFilter} stats={stats} />

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
                    <ShipmentBulkActions
                        count={selectedIds.length}
                        archiveLabel="Move to Storage"
                        deleteLabel="Delete"
                        onArchive={handleBatchArchive}
                        onDelete={handleBatchDelete}
                        onCancel={clearSelection}
                    />

            </AppShell>
            {mobileHeaderActionSheet}
        </>
    );
}
