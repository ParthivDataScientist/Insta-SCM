import React, { useState } from 'react';
import { Archive, RefreshCw, Search } from 'lucide-react';
import { useShipments } from '../shipping/hooks/useShipments';
import { useShipmentSelection } from '../shipping/hooks/useShipmentSelection';
import AppShell from '../components/app/AppShell';
import ShipmentTable from '../shipping/components/ShipmentTable';
import ShipmentDetailPanel from '../shipping/components/ShipmentDetailPanel';
import ShipmentBulkActions from '../shipping/components/ShipmentBulkActions';
import '../design-premium.css';

export default function StoragePremium() {
    const [selected, setSelected] = useState(null);
    const { selectedIds, setSelectedIds, clearSelection } = useShipmentSelection();
    const {
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
    } = useShipments({ initialArchivedView: true });

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
                    <div className="premium-panel" style={{ padding: '16px 18px', color: 'var(--red)' }}>
                        {error}
                    </div>
                ) : null}

                <div className="premium-panel" style={{ padding: '20px 22px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '44px', height: '44px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px', background: 'var(--bg-in)', color: 'var(--tx2)' }}>
                            <Archive size={18} />
                        </div>
                        <div>
                            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--tx)' }}>Archived Shipments</div>
                            <div style={{ fontSize: '12px', color: 'var(--tx3)' }}>{filteredShipments.length} shipment records in storage.</div>
                        </div>
                    </div>
                </div>

                <div className="premium-panel" style={{ overflow: 'hidden' }}>
                    {filteredShipments.length === 0 && !loading ? (
                        <div style={{ padding: '56px 24px', textAlign: 'center', color: 'var(--tx3)' }}>
                            Your storage is currently empty.
                        </div>
                    ) : (
                        <ShipmentTable
                            shipments={filteredShipments}
                            loading={loading}
                            onSelectShipment={setSelected}
                            onDeleteShipment={(id) => {
                                if (window.confirm('Permanently delete this archived shipment?')) {
                                    deleteShipment(id);
                                }
                            }}
                            onArchiveShipment={archiveShipment}
                            selectedIds={selectedIds}
                            onSelectionChange={setSelectedIds}
                        />
                    )}
                </div>

                <ShipmentBulkActions
                    count={selectedIds.length}
                    archiveLabel="Restore to Dashboard"
                    deleteLabel="Delete Permanently"
                    onArchive={() => {
                        batchArchive(selectedIds, false);
                        clearSelection();
                    }}
                    onDelete={() => {
                        if (window.confirm(`Permanently delete ${selectedIds.length} archived shipments?`)) {
                            batchDelete(selectedIds);
                            clearSelection();
                        }
                    }}
                    onCancel={clearSelection}
                />
            </AppShell>
        </>
    );
}
