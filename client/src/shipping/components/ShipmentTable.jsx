import React, { useEffect, useMemo, useState } from 'react';
import { Loader, Package, SlidersHorizontal, X } from 'lucide-react';
import ShipmentMobileCard from './ShipmentMobileCard';
import ShipmentRow from './ShipmentRow';
import ShipmentTableHeader from './ShipmentTableHeader';
import ShipmentTableFiltersSheet from './ShipmentTableFiltersSheet';
import {
    buildInlineChildrenFromMaster,
    buildPositionalGroups,
    readChildPackages,
} from '../utils/shipmentGrouping';
import { expandChildRows } from '../utils/shipmentGrouping';

const ShipmentTable = ({
    shipments,
    loading,
    onSelectShipment,
    onDeleteShipment,
    onArchiveShipment,
    selectedIds = [],
    onSelectionChange = () => {},
    onClearFilters = () => {},
}) => {
    const [idSearch, setIdSearch] = useState('');
    const [exhibitionFilter, setExhibitionFilter] = useState([]);
    const [statusFilter, setStatusFilter] = useState([]);
    const [carrierFilter, setCarrierFilter] = useState([]);
    const [expandedRows, setExpandedRows] = useState(() => new Set());
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    const [mobileActionTarget, setMobileActionTarget] = useState(null);

    const groupedShipments = useMemo(() => (
        buildPositionalGroups(shipments).map((group, index) => {
            const master = group.master;
            const masterKey = master.id != null ? `id:${master.id}` : `tn:${master.tracking_number || index}`;
            const childRows = group.children.length
                ? expandChildRows(group.children, master)
                : buildInlineChildrenFromMaster(master, masterKey);

            return {
                ...group,
                masterKey,
                childRows,
            };
        })
    ), [shipments]);

    const allStatuses = useMemo(
        () => [...new Set(groupedShipments.map((group) => group.master.status).filter(Boolean))],
        [groupedShipments],
    );
    const allCarriers = useMemo(
        () => [...new Set(groupedShipments.map((group) => group.master.carrier).filter(Boolean))],
        [groupedShipments],
    );
    const allExhibitions = useMemo(
        () => [...new Set(groupedShipments.map((group) => group.master.exhibition_name || 'N/A').filter(Boolean))],
        [groupedShipments],
    );

    const matchesTrackingSearch = (row) => {
        const query = idSearch.trim().toLowerCase();
        if (!query) return true;
        const childTokens = readChildPackages(row).join(' ');
        const target = `${row.tracking_number || ''} ${childTokens} ${row.items || ''} ${row.recipient || ''}`.toLowerCase();
        return target.includes(query);
    };

    const filteredGroups = useMemo(() => (
        groupedShipments.filter((group) => {
            const master = group.master;
            const exhibitionName = master.exhibition_name || 'N/A';
            const matchesSearch = matchesTrackingSearch(master) || group.childRows.some((child) => matchesTrackingSearch(child));
            if (!matchesSearch) return false;
            if (exhibitionFilter.length > 0 && !exhibitionFilter.includes(exhibitionName)) return false;
            if (statusFilter.length > 0 && !statusFilter.includes(master.status)) return false;
            if (carrierFilter.length > 0 && !carrierFilter.includes(master.carrier)) return false;
            return true;
        })
    ), [carrierFilter, exhibitionFilter, groupedShipments, idSearch, statusFilter]);

    useEffect(() => {
        const validKeys = new Set(filteredGroups.map((group) => group.masterKey));
        setExpandedRows((previous) => {
            let changed = false;
            const next = new Set();
            previous.forEach((key) => {
                if (validKeys.has(key)) {
                    next.add(key);
                } else {
                    changed = true;
                }
            });
            return changed ? next : previous;
        });
    }, [filteredGroups]);

    const toggleArrayItem = (array, setArray, item) => {
        if (array.includes(item)) {
            setArray(array.filter((entry) => entry !== item));
            return;
        }
        setArray([...array, item]);
    };

    const visibleMasterIds = filteredGroups
        .map((group) => group.master.id)
        .filter((id) => id != null);
    const allVisibleSelected = visibleMasterIds.length > 0 && visibleMasterIds.every((id) => selectedIds.includes(id));
    const hasFilters = Boolean(idSearch || exhibitionFilter.length || statusFilter.length || carrierFilter.length);

    const handleSelectAll = () => {
        if (allVisibleSelected) {
            onSelectionChange(selectedIds.filter((id) => !visibleMasterIds.includes(id)));
            return;
        }
        onSelectionChange([...new Set([...selectedIds, ...visibleMasterIds])]);
    };

    const handleSelectMaster = (event, id) => {
        event.stopPropagation();
        if (id == null) return;
        if (selectedIds.includes(id)) {
            onSelectionChange(selectedIds.filter((entry) => entry !== id));
            return;
        }
        onSelectionChange([...selectedIds, id]);
    };

    const toggleExpanded = (event, masterKey) => {
        event.stopPropagation();
        setExpandedRows((previous) => {
            const next = new Set(previous);
            if (next.has(masterKey)) {
                next.delete(masterKey);
            } else {
                next.add(masterKey);
            }
            return next;
        });
    };

    const clearAllFilters = () => {
        setIdSearch('');
        setExhibitionFilter([]);
        setStatusFilter([]);
        setCarrierFilter([]);
        onClearFilters();
    };

    return (
        <div className="shipment-table-shell">
            {hasFilters ? (
                <div className="shipment-table-toolbar">
                    <button type="button" className="btn-outline-sm shipment-table-toolbar__clear" onClick={clearAllFilters}>
                        Clear All Filters
                    </button>
                </div>
            ) : null}

            {loading ? (
                <div className="shipment-table-loading">
                    <Loader size={32} className="animate-spin shipment-table-loading__icon" />
                    Loading shipments...
                </div>
            ) : (
                <>
                    <div className="shipment-table-mobile">
                        <div className="shipment-mobile-toolbar">
                            <button type="button" className="shipment-mobile-toolbar__button" onClick={() => setShowMobileFilters(true)}>
                                <SlidersHorizontal size={16} />
                                Filters
                                {hasFilters ? <span className="shipment-mobile-toolbar__badge">On</span> : null}
                            </button>
                            {hasFilters ? (
                                <button
                                    type="button"
                                    className="shipment-mobile-toolbar__button shipment-mobile-toolbar__button--ghost"
                                    onClick={clearAllFilters}
                                >
                                    Clear
                                </button>
                            ) : null}
                        </div>

                        <div className="shipment-mobile-list">
                            {filteredGroups.map((group) => (
                                <ShipmentMobileCard
                                    key={`mobile-${group.masterKey}`}
                                    group={group}
                                    onSelectShipment={onSelectShipment}
                                    onOpenActions={setMobileActionTarget}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="shipment-table-desktop">
                        <table className="design-table shipping-table">
                            <ShipmentTableHeader
                                idSearch={idSearch}
                                setIdSearch={setIdSearch}
                                exhibitionFilter={exhibitionFilter}
                                setExhibitionFilter={setExhibitionFilter}
                                statusFilter={statusFilter}
                                setStatusFilter={setStatusFilter}
                                carrierFilter={carrierFilter}
                                setCarrierFilter={setCarrierFilter}
                                allExhibitions={allExhibitions}
                                allStatuses={allStatuses}
                                allCarriers={allCarriers}
                                allVisibleSelected={allVisibleSelected}
                                handleSelectAll={handleSelectAll}
                            />
                            <tbody className="design-table__tbody">
                                {filteredGroups.map((group) => (
                                    <ShipmentRow
                                        key={group.masterKey}
                                        group={group}
                                        isExpanded={expandedRows.has(group.masterKey)}
                                        selectedIds={selectedIds}
                                        onToggleExpanded={toggleExpanded}
                                        onSelectShipment={onSelectShipment}
                                        onDeleteShipment={onDeleteShipment}
                                        onArchiveShipment={onArchiveShipment}
                                        onSelectMaster={handleSelectMaster}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            <ShipmentTableFiltersSheet
                isOpen={showMobileFilters}
                onClose={() => setShowMobileFilters(false)}
                idSearch={idSearch}
                setIdSearch={setIdSearch}
                allStatuses={allStatuses}
                allCarriers={allCarriers}
                allExhibitions={allExhibitions}
                statusFilter={statusFilter}
                carrierFilter={carrierFilter}
                exhibitionFilter={exhibitionFilter}
                onToggleStatus={(status) => toggleArrayItem(statusFilter, setStatusFilter, status)}
                onToggleCarrier={(carrier) => toggleArrayItem(carrierFilter, setCarrierFilter, carrier)}
                onToggleExhibition={(exhibition) => toggleArrayItem(exhibitionFilter, setExhibitionFilter, exhibition)}
                onClearAll={clearAllFilters}
            />

            {mobileActionTarget ? (
                <>
                    <button
                        type="button"
                        className="shipping-mobile-sheet-backdrop"
                        aria-label="Close shipment actions"
                        onClick={() => setMobileActionTarget(null)}
                    />
                    <section className="shipping-mobile-sheet shipping-mobile-sheet--actions" role="dialog" aria-modal="true" aria-label="Shipment actions">
                        <div className="shipping-mobile-sheet__header">
                            <h3>Actions</h3>
                            <button type="button" className="shipping-mobile-sheet__close" onClick={() => setMobileActionTarget(null)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="shipping-mobile-sheet__body">
                            <button
                                type="button"
                                className="shipping-mobile-action"
                                onClick={() => {
                                    onSelectShipment(mobileActionTarget);
                                    setMobileActionTarget(null);
                                }}
                            >
                                View details
                            </button>
                            {onArchiveShipment ? (
                                <button
                                    type="button"
                                    className="shipping-mobile-action"
                                    onClick={() => {
                                        onArchiveShipment(mobileActionTarget.id);
                                        setMobileActionTarget(null);
                                    }}
                                >
                                    {mobileActionTarget.is_archived ? 'Restore to Dashboard' : 'Move to Storage'}
                                </button>
                            ) : null}
                            <button
                                type="button"
                                className="shipping-mobile-action shipping-mobile-action--danger"
                                onClick={() => {
                                    onDeleteShipment(mobileActionTarget.id);
                                    setMobileActionTarget(null);
                                }}
                            >
                                Delete shipment
                            </button>
                        </div>
                    </section>
                </>
            ) : null}

            {filteredGroups.length === 0 && !loading ? (
                <div className="shipment-table-empty">
                    <Package size={40} className="shipment-table-empty__icon" />
                    <p>{groupedShipments.length === 0 ? 'No shipments tracked yet.' : 'No shipments match your filters.'}</p>
                </div>
            ) : null}
        </div>
    );
};

export default ShipmentTable;
