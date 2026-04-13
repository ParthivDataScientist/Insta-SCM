import React, { useMemo, useState } from 'react';
import {
    AlertTriangle,
    CheckCircle,
    Download,
    FileSpreadsheet,
    Menu,
    Package,
    Plus,
    Search,
    Truck,
} from 'lucide-react';
import { useShipments } from '../hooks/useShipments';
import AppShell from '../components/app/AppShell';
import KpiCard from '../components/app/KpiCard';
import ShipmentTable from '../components/ShipmentTable';
import TrackModal from '../components/TrackModal';
import ShipmentDetailPanel from '../components/ShipmentDetailPanel';
import GlobalDateRangePicker from '../components/GlobalDateRangePicker';

export default function ShipmentDashboardPremium() {
    const [selected, setSelected] = useState(null);
    const [selectedIds, setSelectedIds] = useState([]);
    const [showTrack, setShowTrack] = useState(false);
    const [activeKpi, setActiveKpi] = useState('all');
    const [carrierValue, setCarrierValue] = useState('All');
    const [dateValue, setDateValue] = useState('All');

    const {
        shipments,
        stats,
        loading,
        error,
        loadData,
        filteredShipments,
        filter,
        setFilter,
        searchQuery,
        setSearchQuery,
        setCarrierFilter,
        setDateFilter,
        deleteShipment,
        archiveShipment,
        batchDelete,
        batchArchive,
        importExcel,
        refreshTracking,
        exportExcel,
    } = useShipments();

    const alertCount = useMemo(
        () => shipments.filter((shipment) => (shipment.status || '').toLowerCase().includes('exception')).length,
        [shipments]
    );

    const quickFilteredShipments = useMemo(() => {
        if (activeKpi !== 'exceptions') {
            return filteredShipments;
        }
        return filteredShipments.filter((shipment) => (shipment.status || '').toLowerCase().includes('exception'));
    }, [activeKpi, filteredShipments]);

    const importExcelPrompt = () => {
        const input = document.getElementById('excel-file-input');
        input?.click();
    };

    const clearAllFilters = () => {
        setSearchQuery('');
        setFilter('All');
        setCarrierValue('All');
        setCarrierFilter('All');
        setDateValue('All');
        setDateFilter('All');
        setActiveKpi('all');
    };

    const header = ({ toggleSidebar }) => (
        <header className="shipments-header">
            <div className="shipments-header__primary">
                <div className="shipments-header__title-wrap">
                    <button type="button" className="premium-icon-button mobile-only" onClick={toggleSidebar}>
                        <Menu size={18} />
                    </button>
                    <h1 className="shipments-header__title">Shipment Tracking</h1>
                </div>

                <label className="premium-search shipments-header__search">
                    <Search size={16} color="var(--tx3)" />
                    <input
                        type="search"
                        placeholder="Search exhibition, recipient, tracking number..."
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                    />
                </label>

                <GlobalDateRangePicker compact label={false} className="shipments-header__date-range" />

                <button type="button" className="premium-action-button premium-action-button--primary shipments-header__add-btn" onClick={() => setShowTrack(true)}>
                    <Plus size={14} />
                    Add Shipment
                </button>
            </div>

            <div className="shipments-header__secondary">
                <div className="shipments-header__filters">
                    <label className="premium-filter">
                    <Truck size={14} color="var(--tx3)" />
                    <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                        <option value="All">All shipments</option>
                        <option value="Active">Active</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Exception">Exception</option>
                    </select>
                </label>

                    <label className="premium-filter">
                    <Package size={14} color="var(--tx3)" />
                    <select
                        value={carrierValue}
                        onChange={(event) => {
                            setCarrierValue(event.target.value);
                            setCarrierFilter(event.target.value);
                        }}
                    >
                        <option value="All">All carriers</option>
                        <option value="FedEx">FedEx</option>
                        <option value="DHL">DHL</option>
                        <option value="UPS">UPS</option>
                    </select>
                </label>

                    <label className="premium-filter">
                    <select
                        value={dateValue}
                        onChange={(event) => {
                            setDateValue(event.target.value);
                            setDateFilter(event.target.value);
                        }}
                    >
                        <option value="All">All time</option>
                        <option value="Today">Today</option>
                        <option value="Last 7 Days">Last 7 Days</option>
                    </select>
                </label>
                </div>

                <div className="shipments-header__excel-actions">
                    <button type="button" className="premium-action-button" onClick={importExcelPrompt}>
                        <FileSpreadsheet size={14} />
                        Import Excel
                    </button>
                    <button type="button" className="premium-action-button" onClick={exportExcel} disabled={loading}>
                        <Download size={14} />
                        Export Excel
                    </button>
                </div>
            </div>
        </header>
    );

    return (
        <>
            {showTrack ? <TrackModal onClose={() => setShowTrack(false)} onTracked={loadData} /> : null}
            {selected ? <ShipmentDetailPanel shipment={selected} onClose={() => setSelected(null)} onDeleted={loadData} /> : null}

            <input
                id="excel-file-input"
                type="file"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                        importExcel(file);
                    }
                    event.target.value = '';
                }}
            />

            <AppShell
                activeNav="dashboard"
                header={header}
                pageClassName="shipments-page"
                mainClassName="shipments-main"
                showGlobalDate={false}
            >
                <div className="premium-grid shipments-kpi-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                    <KpiCard icon={Truck} label="Active Shipments" value={stats.total ?? 0} detail="Master and child shipments in flow" tone="blue" className="shipments-kpi shipments-kpi--active" />
                    <KpiCard icon={Package} label="In Transit" value={stats.transit ?? 0} detail="Live movement across carriers" tone="orange" className="shipments-kpi shipments-kpi--transit" />
                    <KpiCard icon={CheckCircle} label="Delivered" value={stats.delivered ?? 0} detail="Completed deliveries" tone="green" className="shipments-kpi shipments-kpi--delivered" />
                    <KpiCard
                        icon={AlertTriangle}
                        label="Exceptions"
                        value={stats.exceptions ?? alertCount}
                        detail="Shipments needing attention"
                        tone="red"
                        active={activeKpi === 'exceptions'}
                        onClick={() => setActiveKpi((value) => (value === 'exceptions' ? 'all' : 'exceptions'))}
                        className="shipments-kpi shipments-kpi--exceptions"
                    />
                </div>

                {error ? (
                    <div className="premium-panel" style={{ padding: '16px 18px', color: 'var(--red)' }}>
                        {error}
                    </div>
                ) : null}

                <div className="premium-panel" style={{ overflow: 'hidden' }}>
                    {quickFilteredShipments.length === 0 && !loading ? (
                        <div className="shipments-empty-state">
                            <AlertTriangle size={40} />
                            <strong>No shipments match the current filters</strong>
                            <span>Try broadening your search, date range, or carrier selection.</span>
                            <button type="button" className="premium-action-button" onClick={clearAllFilters}>
                                Clear Filters
                            </button>
                        </div>
                    ) : (
                        <ShipmentTable
                            shipments={quickFilteredShipments}
                            allShipments={shipments}
                            loading={loading}
                            onSelectShipment={setSelected}
                            onDeleteShipment={(id) => {
                                if (window.confirm('Delete this shipment?')) {
                                    deleteShipment(id);
                                }
                            }}
                            onArchiveShipment={archiveShipment}
                            onRefreshShipment={refreshTracking}
                            onTracked={loadData}
                            selectedIds={selectedIds}
                            onSelectionChange={setSelectedIds}
                            onClearFilters={clearAllFilters}
                        />
                    )}
                </div>

                {selectedIds.length > 0 ? (
                    <div className="premium-panel" style={{ padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tx)' }}>
                            {selectedIds.length} shipment{selectedIds.length > 1 ? 's' : ''} selected
                        </div>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <button type="button" className="premium-action-button" onClick={() => { batchArchive(selectedIds, true); setSelectedIds([]); }}>
                                Move to Storage
                            </button>
                            <button
                                type="button"
                                className="premium-action-button"
                                onClick={() => {
                                    if (window.confirm(`Delete ${selectedIds.length} shipments?`)) {
                                        batchDelete(selectedIds);
                                        setSelectedIds([]);
                                    }
                                }}
                            >
                                Delete
                            </button>
                            <button type="button" className="premium-action-button" onClick={() => setSelectedIds([])}>
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : null}
            </AppShell>
        </>
    );
}
