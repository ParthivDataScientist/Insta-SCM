import React, { useMemo, useState } from 'react';
import {
    AlertTriangle,
    CheckCircle,
    Download,
    FileSpreadsheet,
    Package,
    Plus,
    RefreshCw,
    Search,
    Truck,
} from 'lucide-react';
import { useShipments } from '../hooks/useShipments';
import AppShell from '../components/app/AppShell';
import KpiCard from '../components/app/KpiCard';
import ShipmentTable from '../components/ShipmentTable';
import TrackModal from '../components/TrackModal';
import ShipmentDetailPanel from '../components/ShipmentDetailPanel';

export default function ShipmentDashboardPremium() {
    const [selected, setSelected] = useState(null);
    const [selectedIds, setSelectedIds] = useState([]);
    const [showTrack, setShowTrack] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

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

    const handleRefresh = async () => {
        await refreshTracking();
        setLastUpdated(new Date());
    };

    const importExcelPrompt = () => {
        const input = document.getElementById('excel-file-input');
        input?.click();
    };

    const actions = (
        <>
            {lastUpdated ? (
                <span style={{ fontSize: '12px', color: 'var(--tx3)', whiteSpace: 'nowrap' }}>
                    Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            ) : null}
            <button type="button" className="premium-action-button" onClick={() => setShowTrack(true)}>
                <Plus size={14} />
                Add Shipment
            </button>
            <button type="button" className="premium-action-button premium-action-button--primary" onClick={handleRefresh} disabled={loading}>
                <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                Refresh
            </button>
        </>
    );

    const headerCenter = (
        <label className="premium-search">
            <Search size={16} color="var(--tx3)" />
            <input
                type="search"
                placeholder="Search exhibition, recipient, tracking number..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
            />
        </label>
    );

    const toolbar = (
        <div className="premium-filter-group" style={{ justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                <label className="premium-filter" style={{ minWidth: '180px' }}>
                    <Truck size={14} color="var(--tx3)" />
                    <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                        <option value="All">All shipments</option>
                        <option value="Active">Active</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Exception">Exception</option>
                    </select>
                </label>

                <label className="premium-filter" style={{ minWidth: '180px' }}>
                    <Package size={14} color="var(--tx3)" />
                    <select defaultValue="All" onChange={(event) => setCarrierFilter(event.target.value)}>
                        <option value="All">All carriers</option>
                        <option value="FedEx">FedEx</option>
                        <option value="DHL">DHL</option>
                        <option value="UPS">UPS</option>
                    </select>
                </label>

                <label className="premium-filter" style={{ minWidth: '160px' }}>
                    <RefreshCw size={14} color="var(--tx3)" />
                    <select defaultValue="All" onChange={(event) => setDateFilter(event.target.value)}>
                        <option value="All">All time</option>
                        <option value="Today">Today</option>
                        <option value="Last 7 Days">Last 7 Days</option>
                    </select>
                </label>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
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
                title="Shipment Tracking"
                subtitle="Monitor carriers, exceptions and delivery progress from one premium workspace."
                headerCenter={headerCenter}
                actions={actions}
                toolbar={toolbar}
            >
                <div className="premium-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                    <KpiCard icon={Truck} label="Active Shipments" value={stats.total ?? 0} detail="Master and child shipments in flow" tone="blue" />
                    <KpiCard icon={Package} label="In Transit" value={stats.transit ?? 0} detail="Live movement across carriers" tone="orange" />
                    <KpiCard icon={CheckCircle} label="Delivered" value={stats.delivered ?? 0} detail="Completed deliveries" tone="green" />
                    <KpiCard icon={AlertTriangle} label="Exceptions" value={stats.exceptions ?? alertCount} detail="Shipments needing attention" tone="red" />
                </div>

                {error ? (
                    <div className="premium-panel" style={{ padding: '16px 18px', color: 'var(--red)' }}>
                        {error}
                    </div>
                ) : null}

                <div className="premium-panel" style={{ overflow: 'hidden' }}>
                    {filteredShipments.length === 0 && !loading ? (
                        <div style={{ padding: '56px 24px', textAlign: 'center', color: 'var(--tx3)' }}>
                            No shipments match the current filters.
                        </div>
                    ) : (
                        <ShipmentTable
                            shipments={filteredShipments}
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
