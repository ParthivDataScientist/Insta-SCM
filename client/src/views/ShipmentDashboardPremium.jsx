import React, { useEffect, useState } from 'react';
import { Truck, Package, CheckCircle, AlertTriangle, Search, X, PanelLeft, Menu, Plus, Download, FileSpreadsheet, Archive, Trash2, RefreshCw, Bell, MoreHorizontal, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useShipments } from '../hooks/useShipments';
import { useAuth } from '../contexts/AuthContext';
import ShipmentTable from '../components/ShipmentTable';
import TrackModal from '../components/TrackModal';
import ShipmentDetailPanel from '../components/ShipmentDetailPanel';
import ShipmentSidePanel from '../components/ShipmentSidePanel';
import AppShell from '../components/app/AppShell';
import AppLogo from '../components/app/AppLogo';
import KpiCard from '../components/app/KpiCard';
import PremiumDateRangePicker from '../components/PremiumDateRangePicker';
import AlertBanner from '../components/AlertBanner';
import '../design-premium.css';
import GoogleSheetsTabBar from '../components/GoogleSheetsTabBar';
import { isUsaShipment, isEuropeShipment, isIndiaShipment } from '../utils/regionFilter';

export default function ShipmentDashboardPremium() {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const {
        shipments, stats, loading, refreshing, error, loadData, filteredShipments,
        filter, setFilter, setSearchQuery, searchQuery, setCarrierFilter, setDateFilter,
        selectedIds, setSelectedIds, handleSelectAll,
        deleteShipment, archiveShipment, batchDelete, batchArchive, importExcel, refreshTracking, exportExcel,
        updateShipment,
    } = useShipments();

    const [activeSheetTab, setActiveSheetTab] = useState('all');

    // Counts for sheet tabs based on current global filters
    const allMatchingCount = filteredShipments.length;
    const usaMatchingCount = filteredShipments.filter(isUsaShipment).length;
    const europeMatchingCount = filteredShipments.filter(isEuropeShipment).length;
    const indiaMatchingCount = filteredShipments.filter(isIndiaShipment).length;

    // Dynamically filtered shipments for grid display
    const sheetFilteredShipments = React.useMemo(() => {
        if (activeSheetTab === 'usa') {
            return filteredShipments.filter(isUsaShipment);
        }
        if (activeSheetTab === 'europe') {
            return filteredShipments.filter(isEuropeShipment);
        }
        if (activeSheetTab === 'india') {
            return filteredShipments.filter(isIndiaShipment);
        }
        return filteredShipments;
    }, [activeSheetTab, filteredShipments]);

    // Override Stats dynamically based on region of active sheet
    const activeSheetStats = React.useMemo(() => {
        const regionShipments = shipments.filter(item => {
            if (activeSheetTab === 'usa') return isUsaShipment(item);
            if (activeSheetTab === 'europe') return isEuropeShipment(item);
            if (activeSheetTab === 'india') return isIndiaShipment(item);
            return true;
        });

        const total = regionShipments.length;
        const transit = regionShipments.filter(item => item.status !== 'Delivered').length;
        const delivered = regionShipments.filter(item => item.status === 'Delivered').length;
        const exceptions = regionShipments.filter(item => (item.status || '').toLowerCase().includes('exception')).length;

        return { total, transit, delivered, exceptions };
    }, [activeSheetTab, shipments]);

    const [selectedShipment, setSelectedShipment] = useState(null);
    const [displayedShipmentIds, setDisplayedShipmentIds] = useState([]);
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
        const idsToExport = selected.length > 0 ? selected : displayedShipmentIds;
        if (idsToExport.length === 0) {
            window.alert('No shipments available to export for the current selection/filter.');
            return;
        }
        await exportExcel(idsToExport);
    };

    const header = ({ toggleSidebar, sidebarOverlay, sidebarOpen, logout }) => (
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
                            <AppLogo className="design-premium-header__logo" />
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
                                <Plus size={15} /> Track Shipment
                            </button>

                            <button className="design-premium-btn" onClick={() => navigate('/shipments/new')}>
                                <Truck size={15} /> Book Shipment
                            </button>

                            <button
                                type="button"
                                className="design-premium-icon-btn"
                                title="Notifications"
                            >
                                <Bell size={18} />
                                <span className="design-premium-icon-btn__badge"></span>
                            </button>

                            <button
                                type="button"
                                className="design-premium-icon-btn design-premium-icon-btn--danger"
                                onClick={logout}
                                title="Logout"
                                style={{ color: '#ef4444' }}
                            >
                                <LogOut size={18} />
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
                        <Plus size={16} /> Track Shipment
                    </button>
                    <button
                        type="button"
                        className="shipping-mobile-action"
                        onClick={() => {
                            navigate('/shipments/new');
                            setShowMobileHeaderActions(false);
                        }}
                    >
                        <Truck size={16} /> Book Shipment
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
                    <button
                        type="button"
                        className="shipping-mobile-action shipping-mobile-action--danger"
                        style={{ color: '#ef4444' }}
                        onClick={() => {
                            if (logout) logout();
                            setShowMobileHeaderActions(false);
                        }}
                    >
                        <LogOut size={16} /> Logout
                    </button>
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
                mainClassName="premium-main--design premium-main--shipping"
                pageClassName="design-dashboard-page shipping-dashboard-page"
                sidebarOverlay
            >
                <AlertBanner message={error} />

                {refreshing && (
                    <div className="shipping-sync-indicator" style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 16px',
                        marginBottom: '16px',
                        borderRadius: '8px',
                        background: 'rgba(59, 130, 246, 0.08)',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        color: '#2563eb',
                        fontSize: '0.85rem',
                        fontWeight: '500',
                        width: 'fit-content',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                        backdropFilter: 'blur(4px)',
                        animation: 'fadeIn 0.3s ease-out'
                    }}>
                        <RefreshCw size={14} style={{ animation: 'spin 1.5s linear infinite' }} />
                        <span>Fetching latest live tracking from DHL...</span>
                    </div>
                )}

                <div className="premium-sliding-layout premium-sliding-layout--compact">
                    <div className={`premium-sliding-main ${selectedShipment || showTrack ? 'is-shrunk' : ''}`}>
                        <div className="design-dashboard__kpi-grid">
                            <KpiCard
                                icon={Truck}
                                label="Total Shipments"
                                value={`${activeSheetStats.total ?? 0}`}
                                active={filter === 'All'}
                                onClick={() => setFilter('All')}
                                className="design-dashboard__kpi design-dashboard__kpi--all"
                            />
                            <KpiCard
                                icon={Package}
                                label="In Transit"
                                value={`${activeSheetStats.transit ?? 0}`}
                                tone="blue"
                                active={filter === 'Active'}
                                onClick={() => setFilter('Active')}
                                className="design-dashboard__kpi design-dashboard__kpi--pending"
                            />
                            <KpiCard
                                icon={CheckCircle}
                                label="Delivered"
                                value={`${activeSheetStats.delivered ?? 0}`}
                                tone="green"
                                active={filter === 'Delivered'}
                                onClick={() => setFilter('Delivered')}
                                className="design-dashboard__kpi design-dashboard__kpi--won"
                            />
                            <KpiCard
                                icon={AlertTriangle}
                                label="Exceptions"
                                value={`${activeSheetStats.exceptions ?? 0}`}
                                tone="red"
                                active={filter === 'Exception'}
                                onClick={() => setFilter('Exception')}
                                className="design-dashboard__kpi design-dashboard__kpi--lost"
                            />
                        </div>

                        <div className="design-dashboard__table-shell shipping-table-panel">
                             <ShipmentTable
                                shipments={sheetFilteredShipments}
                                loading={loading}
                                error={error}
                                onRetry={() => loadData(false)}
                                onImportShipments={importExcelPrompt}
                                onBookShipment={() => navigate('/shipments/new')}
                                onSelectShipment={(s) => {
                                    setSelectedShipment(s);
                                    setShowTrack(false);
                                }}
                                onDeleteShipment={handleDelete}
                                onArchiveShipment={handleArchive}
                                selectedIds={selectedIds}
                                onSelectionChange={setSelectedIds}
                                onSelectAll={handleSelectAll}
                                selectedShipment={selectedShipment}
                                onFilteredShipmentsChange={setDisplayedShipmentIds}
                                onUpdateShipment={updateShipment}
                            />
                            <GoogleSheetsTabBar
                                activeTab={activeSheetTab}
                                setActiveTab={setActiveSheetTab}
                                allCount={allMatchingCount}
                                usaCount={usaMatchingCount}
                                europeCount={europeMatchingCount}
                                indiaCount={indiaMatchingCount}
                            />
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
            {mobileHeaderActionSheet}
        </>
    );
}
