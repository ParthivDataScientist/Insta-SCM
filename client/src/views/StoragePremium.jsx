import React, { useEffect, useState } from 'react';
import { Archive, RefreshCw, Search, Trash2 } from 'lucide-react';
import { useShipments } from '../hooks/useShipments';
import AppShell from '../components/app/AppShell';
import ShipmentTable from '../components/ShipmentTable';
import ShipmentDetailPanel from '../components/ShipmentDetailPanel';

export default function StoragePremium() {
    const [selected, setSelected] = useState(null);
    const [selectedIds, setSelectedIds] = useState([]);
    const {
        shipments,
        loading,
        error,
        loadData,
        filteredShipments,
        searchQuery,
        setSearchQuery,
        deleteShipment,
        archiveShipment,
        batchDelete,
        batchArchive,
    } = useShipments();

    useEffect(() => {
        loadData(true);
    }, [loadData]);

    const actions = (
        <button type="button" className="premium-action-button premium-action-button--primary" onClick={() => loadData(true)} disabled={loading}>
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
        </button>
    );

    const headerCenter = (
        <label className="premium-search">
            <Search size={16} color="var(--tx3)" />
            <input
                type="search"
                placeholder="Search archived shipments..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
            />
        </label>
    );

    return (
        <>
            {selected ? (
                <ShipmentDetailPanel
                    shipment={selected}
                    onClose={() => setSelected(null)}
                    onDeleted={() => loadData(true)}
                />
            ) : null}

            <AppShell
                activeNav="storage"
                title="Storage"
                subtitle="Archived shipments and historical movement records."
                headerCenter={headerCenter}
                actions={actions}
            >
                {error ? (
                    <div className="premium-banner">
                        {error}
                    </div>
                ) : null}

                <div className="premium-inline-card">
                    <div>
                        <div className="premium-inline-card__title">Archived shipments</div>
                        <div className="premium-inline-card__meta">{filteredShipments.length} shipment records in storage.</div>
                    </div>
                    <Archive size={18} color="var(--tx3)" />
                </div>

                <div className="premium-panel" style={{ overflow: 'hidden' }}>
                    {filteredShipments.length === 0 && !loading ? (
                        <div style={{ padding: '56px 24px', textAlign: 'center', color: 'var(--tx3)' }}>
                            Your storage is currently empty.
                        </div>
                    ) : (
                        <ShipmentTable
                            shipments={filteredShipments}
                            allShipments={shipments}
                            loading={loading}
                            onSelectShipment={setSelected}
                            onDeleteShipment={(id) => {
                                if (window.confirm('Permanently delete this archived shipment?')) {
                                    deleteShipment(id);
                                }
                            }}
                            onArchiveShipment={archiveShipment}
                            onTracked={() => loadData(true)}
                            selectedIds={selectedIds}
                            onSelectionChange={setSelectedIds}
                        />
                    )}
                </div>

                {selectedIds.length > 0 ? (
                    <div className="premium-bulkbar">
                        <div className="premium-bulkbar__count">
                            {selectedIds.length} archived shipment{selectedIds.length > 1 ? 's' : ''} selected
                        </div>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <button type="button" className="premium-action-button" onClick={() => { batchArchive(selectedIds, false); setSelectedIds([]); }}>
                                Restore to Dashboard
                            </button>
                            <button
                                type="button"
                                className="premium-action-button"
                                onClick={() => {
                                    if (window.confirm(`Permanently delete ${selectedIds.length} archived shipments?`)) {
                                        batchDelete(selectedIds);
                                        setSelectedIds([]);
                                    }
                                }}
                            >
                                <Trash2 size={14} />
                                Delete Permanently
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
