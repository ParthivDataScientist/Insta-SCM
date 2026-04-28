import React, { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
    Check,
    ChevronDown,
    ChevronRight,
    Filter,
    Loader,
    MoreHorizontal,
    Package,
    Search,
    SlidersHorizontal,
    Trash2,
    X,
} from 'lucide-react';
import ShipmentStatusBadge from './ShipmentStatusBadge';
import ProgressBar from './ProgressBar';

function useOnClickOutside(ref, handler) {
    useEffect(() => {
        const listener = (event) => {
            if (!ref.current || ref.current.contains(event.target)) return;
            handler(event);
        };
        document.addEventListener('mousedown', listener);
        document.addEventListener('touchstart', listener);
        return () => {
            document.removeEventListener('mousedown', listener);
            document.removeEventListener('touchstart', listener);
        };
    }, [ref, handler]);
}

import {
    displayValue,
    shortLocation,
    readChildPackages,
    readParentTrackingNumber,
    getCurrentStatusMeta,
    formatLastUpdateLine,
    shortRouteLabel,
    buildPositionalGroups,
    expandChildRows,
    buildInlineChildrenFromMaster,
} from '../utils/shipmentGrouping';

import {
    isUpcomingDate as isUpcomingShowDate,
    formatShowDateDisplay,
    parseComparableDate,
    formatDateTime
} from '../utils/dateFormatters';

// Keep the local helper for booking date since it uses the same signature but different context if needed, or just reuse.
const isUpcomingBookingDate = isUpcomingShowDate;

const toChildSelectionPayload = (child, master) => ({
    ...(child.__sourceChild || child),
    ...child,
    id: child?.__sourceChild?.id ?? (child?.id === master?.id ? null : (child?.id ?? null)),
    history: Array.isArray(child?.history) && child.history.length > 0
        ? child.history
        : (Array.isArray(master?.history) ? master.history : []),
    tracking_number: child.__displayTracking || child.tracking_number,
    master_tracking_number: master?.tracking_number || readParentTrackingNumber(child) || null,
    is_master: false,
});


const FilterPopover = ({ title, className = '', isActive, onClear, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef();
    useOnClickOutside(ref, () => setIsOpen(false));

    return (
        <th className={`filter-th design-table__th design-table__th--left ${className}`} ref={ref}>
            <button type="button" className="th-content shipment-table__filter-trigger" onClick={() => setIsOpen((prev) => !prev)}>
                <span>{title}</span>
                <span className={`filter-icon-wrapper ${isActive ? 'active' : ''}`}>
                    <Filter size={13} />
                    <ChevronDown size={12} className={`chevron ${isOpen ? 'open' : ''}`} />
                </span>
            </button>
            {isOpen && (
                <div className="filter-popover" onClick={(event) => event.stopPropagation()}>
                    <div className="fp-header">
                        <span className="fp-title">Filter {title}</span>
                        {isActive ? (
                            <button
                                type="button"
                                className="fp-clear"
                                onClick={() => {
                                    onClear();
                                    setIsOpen(false);
                                }}
                            >
                                Clear
                            </button>
                        ) : null}
                    </div>
                    <div className="fp-body">{children}</div>
                </div>
            )}
        </th>
    );
};

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
    ), [groupedShipments, exhibitionFilter, statusFilter, carrierFilter, idSearch]);

    useEffect(() => {
        const validKeys = new Set(filteredGroups.map((group) => group.masterKey));
        setExpandedRows((prev) => {
            let changed = false;
            const next = new Set();
            prev.forEach((key) => {
                if (validKeys.has(key)) {
                    next.add(key);
                } else {
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [filteredGroups]);

    const toggleArrayItem = (array, setArray, item) => {
        if (array.includes(item)) {
            setArray(array.filter((entry) => entry !== item));
        } else {
            setArray([...array, item]);
        }
    };

    const visibleMasterIds = filteredGroups
        .map((group) => group.master.id)
        .filter((id) => id != null);
    const allVisibleSelected = visibleMasterIds.length > 0 && visibleMasterIds.every((id) => selectedIds.includes(id));
    const hasFilters = Boolean(idSearch || exhibitionFilter.length || statusFilter.length || carrierFilter.length);

    const handleSelectAll = () => {
        if (allVisibleSelected) {
            onSelectionChange(selectedIds.filter((id) => !visibleMasterIds.includes(id)));
        } else {
            onSelectionChange([...new Set([...selectedIds, ...visibleMasterIds])]);
        }
    };

    const handleSelectMaster = (event, id) => {
        event.stopPropagation();
        if (id == null) return;
        if (selectedIds.includes(id)) {
            onSelectionChange(selectedIds.filter((entry) => entry !== id));
        } else {
            onSelectionChange([...selectedIds, id]);
        }
    };

    const toggleExpanded = (event, masterKey) => {
        event.stopPropagation();
        setExpandedRows((prev) => {
            const next = new Set(prev);
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
                    <button
                        type="button"
                        className="btn-outline-sm shipment-table-toolbar__clear"
                        onClick={clearAllFilters}
                    >
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
                            <button
                                type="button"
                                className="shipment-mobile-toolbar__button"
                                onClick={() => setShowMobileFilters(true)}
                            >
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
                            {filteredGroups.map(({ master, childRows, masterKey }) => (
                                <article
                                    key={`mobile-${masterKey}`}
                                    className={`shipment-mobile-card ${isUpcomingBookingDate(master.booking_date) ? 'shipment-mobile-card--upcoming' : ''}`}
                                >
                                    <div className="shipment-mobile-card__top">
                                        <div className="shipment-mobile-card__title-wrap">
                                            <h3 className="shipment-mobile-card__client">
                                                {master.recipient || master.project_client_name || 'Unknown Client'}
                                            </h3>
                                            <div className="shipment-mobile-card__status">
                                                <ShipmentStatusBadge status={master.status} />
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="shipment-mobile-card__menu"
                                            aria-label="Shipment actions"
                                            onClick={() => setMobileActionTarget(master)}
                                        >
                                            <MoreHorizontal size={18} />
                                        </button>
                                    </div>

                                    <div className="shipment-mobile-card__meta-grid">
                                        <div className="shipment-mobile-card__meta">
                                            <span className="shipment-mobile-card__label">Courier</span>
                                            <span className="shipment-mobile-card__value">{displayValue(master.carrier)}</span>
                                        </div>
                                        <div className="shipment-mobile-card__meta">
                                            <span className="shipment-mobile-card__label">Route</span>
                                            <span className="shipment-mobile-card__value">{shortRouteLabel(master)}</span>
                                        </div>
                                    </div>

                                    <div
                                        className="shipment-mobile-card__update"
                                        title={formatLastUpdateLine(master)}
                                    >
                                        {formatLastUpdateLine(master)}
                                    </div>

                                    <div className="shipment-mobile-card__footer">
                                        <button
                                            type="button"
                                            className="shipment-mobile-card__track"
                                            onClick={() => onSelectShipment(master)}
                                        >
                                            Track
                                        </button>
                                        <span className="shipment-mobile-card__tracking">{displayValue(master.tracking_number)}</span>
                                        {childRows.length > 0 ? (
                                            <span className="shipment-mobile-card__children">+{childRows.length} parcels</span>
                                        ) : null}
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>

                    <div className="shipment-table-desktop">
                        <table className="design-table shipping-table">
                    <thead className="design-table__thead">
                        <tr>
                            <th className="design-table__th design-table__th--left shipping-col-check">
                                <button type="button" className={`custom-checkbox ${allVisibleSelected ? 'checked' : ''}`} onClick={handleSelectAll}>
                                    {allVisibleSelected ? <Check size={10} /> : null}
                                </button>
                            </th>

                            <FilterPopover title="Master Tracking ID" className="shipping-col-id" isActive={Boolean(idSearch)} onClear={() => setIdSearch('')}>
                                <div className="fp-search">
                                    <Search size={14} className="fps-icon" />
                                    <input
                                        placeholder="Search tracking, items, recipient..."
                                        value={idSearch}
                                        onChange={(event) => setIdSearch(event.target.value)}
                                    />
                                </div>
                            </FilterPopover>

                            <FilterPopover title="Status" className="shipping-col-status" isActive={statusFilter.length > 0} onClear={() => setStatusFilter([])}>
                                <div className="fp-check-list">
                                    {allStatuses.length === 0 ? <div className="fp-empty">No data</div> : allStatuses.map((status) => (
                                        <label key={status} className="fp-check-item">
                                            <span className={`custom-checkbox ${statusFilter.includes(status) ? 'checked' : ''}`}>
                                                {statusFilter.includes(status) ? <Check size={10} /> : null}
                                            </span>
                                            <input
                                                type="checkbox"
                                                className="fp-check-input"
                                                checked={statusFilter.includes(status)}
                                                onChange={() => toggleArrayItem(statusFilter, setStatusFilter, status)}
                                            />
                                            <span className="fp-label">{status}</span>
                                        </label>
                                    ))}
                                </div>
                            </FilterPopover>

                            <th className="design-table__th design-table__th--left shipping-col-current">Current Status</th>
                            <th className="design-table__th design-table__th--left shipping-col-eta">Date</th>
                            <th className="design-table__th design-table__th--left shipping-col-show-date">Show Date</th>

                            <FilterPopover title="Carrier" className="shipping-col-carrier" isActive={carrierFilter.length > 0} onClear={() => setCarrierFilter([])}>
                                <div className="fp-check-list">
                                    {allCarriers.length === 0 ? <div className="fp-empty">No data</div> : allCarriers.map((carrier) => (
                                        <label key={carrier} className="fp-check-item">
                                            <span className={`custom-checkbox ${carrierFilter.includes(carrier) ? 'checked' : ''}`}>
                                                {carrierFilter.includes(carrier) ? <Check size={10} /> : null}
                                            </span>
                                            <input
                                                type="checkbox"
                                                className="fp-check-input"
                                                checked={carrierFilter.includes(carrier)}
                                                onChange={() => toggleArrayItem(carrierFilter, setCarrierFilter, carrier)}
                                            />
                                            <span className="fp-label">{carrier}</span>
                                        </label>
                                    ))}
                                </div>
                            </FilterPopover>

                            <th className="design-table__th design-table__th--left shipping-col-route">Route</th>
                            <th className="design-table__th design-table__th--left shipping-col-actions">Actions</th>
                        </tr>
                    </thead>

                    <tbody>
                        {filteredGroups.map(({ master, childRows, masterKey }) => {
                            const hasChildren = childRows.length > 0;
                            const isExpanded = expandedRows.has(masterKey);
                            const isSelected = master.id != null && selectedIds.includes(master.id);
                            const masterHasUpcomingShow = isUpcomingShowDate(master.show_date);
                            const masterHasUpcomingBooking = isUpcomingBookingDate(master.booking_date);
                            const masterStatusMeta = getCurrentStatusMeta(master);
                            const masterStatusTitle = [masterStatusMeta.date, masterStatusMeta.headline, masterStatusMeta.location]
                                .filter(Boolean)
                                .join(' | ');

                            return (
                                <Fragment key={masterKey}>
                                    <tr className={`design-table__row shipping-row ${isSelected ? 'shipping-row--selected' : ''} ${masterHasUpcomingShow ? 'shipping-row--upcoming-show' : ''} ${masterHasUpcomingBooking ? 'shipping-row--upcoming-booking' : ''}`} onClick={() => onSelectShipment(master)}>
                                        <td className="design-table__td shipping-col-check" onClick={(event) => handleSelectMaster(event, master.id)}>
                                            <span className={`custom-checkbox ${isSelected ? 'checked' : ''}`}>
                                                {isSelected ? <Check size={10} /> : null}
                                            </span>
                                        </td>

                                        <td className="design-table__td shipping-col-id">
                                            <div className="shipment-main-cell">
                                                {hasChildren ? (
                                                    <button
                                                        type="button"
                                                        className="child-nav"
                                                        aria-label={isExpanded ? 'Collapse child packages' : 'Expand child packages'}
                                                        aria-expanded={isExpanded}
                                                        onClick={(event) => toggleExpanded(event, masterKey)}
                                                    >
                                                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                    </button>
                                                ) : (
                                                    <span className="shipment-nav-spacer" />
                                                )}

                                                <span className="tid-icon">
                                                    <Package size={14} />
                                                </span>

                                                <div className="shipment-main-cell__content truncate-cell" title={master.items || master.recipient || 'Shipment'}>
                                                    <div className="tid-name">{master.items && master.items !== 'Package' ? master.items : (master.recipient || 'Shipment')}</div>
                                                    <div className="tid-num">
                                                        {displayValue(master.tracking_number)}
                                                        {hasChildren ? <span className="shipment-child-count">+{childRows.length}</span> : null}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="design-table__td shipping-col-status">
                                            <div className="shipment-status-cell">
                                                <ShipmentStatusBadge status={master.status} />
                                                {master.status !== 'Delivered' && master.progress != null ? (
                                                    <ProgressBar percentage={master.progress} status={master.status} mini />
                                                ) : null}
                                            </div>
                                        </td>

                                        <td className="design-table__td shipping-col-current">
                                            <div className="shipment-current-status" title={masterStatusTitle}>
                                                {masterStatusMeta.date ? (
                                                    <span className="shipment-current-status__date">{masterStatusMeta.date}</span>
                                                ) : null}
                                                <span className="shipment-current-status__headline">{masterStatusMeta.headline}</span>
                                                {masterStatusMeta.location ? (
                                                    <span className="shipment-current-status__location">{masterStatusMeta.location}</span>
                                                ) : null}
                                            </div>
                                        </td>

                                        <td className="design-table__td shipping-col-eta">
                                            <div className="shipment-date-cell">
                                                {(() => {
                                                    const formatted = formatDateTime(master.eta);
                                                    if (typeof formatted === 'object') {
                                                        return (
                                                            <>
                                                                <span className="shipment-date-cell__date">{formatted.datePart}</span>
                                                                <span className="shipment-date-cell__time">{formatted.timePart}</span>
                                                            </>
                                                        );
                                                    }
                                                    return <span className="shipment-date-cell__date">{formatted || '-'}</span>;
                                                })()}
                                            </div>
                                        </td>

                                        <td className="design-table__td shipping-col-show-date">
                                            <div className="shipment-date-cell">
                                                <span className="shipment-date-cell__date">{formatShowDateDisplay(master.show_date)}</span>
                                            </div>
                                        </td>

                                        <td className="design-table__td shipping-col-carrier">
                                            <span className="carrier-cell">{displayValue(master.carrier)}</span>
                                        </td>

                                        <td className="design-table__td shipping-col-route">
                                            <div className="shipment-route-cell">
                                                <div className="shipment-route-line">
                                                    <span className="shipment-route-label">FROM</span>
                                                    <span>{shortLocation(master.origin)}</span>
                                                </div>
                                                <div className="shipment-route-line">
                                                    <span className="shipment-route-label">TO</span>
                                                    <span>{shortLocation(master.destination)}</span>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="design-table__td action-cell shipping-col-actions" onClick={(event) => event.stopPropagation()}>
                                            <div className="action-cell__inner">
                                                <button type="button" className="track-btn" onClick={() => onSelectShipment(master)}>Track</button>
                                                {onArchiveShipment ? (
                                                    <button
                                                        type="button"
                                                        className="archive-btn"
                                                        title={master.is_archived ? 'Restore to Dashboard' : 'Move to Storage'}
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            onArchiveShipment(master.id);
                                                        }}
                                                    >
                                                        {master.is_archived ? 'Restore' : 'Move'}
                                                    </button>
                                                ) : null}
                                                <button
                                                    type="button"
                                                    className="delete-btn"
                                                    title="Delete shipment"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        onDeleteShipment(master.id);
                                                    }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>

                                    {isExpanded ? childRows.map((child) => {
                                        const childHasUpcomingShow = isUpcomingShowDate(child.show_date || master.show_date);
                                        const childHasUpcomingBooking = isUpcomingBookingDate(child.booking_date || master.booking_date);
                                        const childStatusMeta = getCurrentStatusMeta(child);
                                        const childStatusTitle = [childStatusMeta.date, childStatusMeta.headline, childStatusMeta.location]
                                            .filter(Boolean)
                                            .join(' | ');
                                        return (
                                        <tr
                                            key={child.__rowKey}
                                            className={`design-table__row shipping-row shipping-row--child ${childHasUpcomingShow ? 'shipping-row--upcoming-show' : ''} ${childHasUpcomingBooking ? 'shipping-row--upcoming-booking' : ''}`}
                                            onClick={() => onSelectShipment(toChildSelectionPayload(child, master))}
                                        >
                                            <td className="design-table__td shipping-col-check" />

                                            <td className="design-table__td shipping-col-id">
                                                <div className="shipment-main-cell nested-cell">
                                                    <span className="hierarchy-connector" />
                                                    <span className="tid-icon child-icon">
                                                        <Package size={12} />
                                                    </span>
                                                    <div className="shipment-main-cell__content truncate-cell">
                                                        <div className="tid-name child-name">{child.items && child.items !== 'Package' ? child.items : 'Child Package'}</div>
                                                        <div className="tid-num">{displayValue(child.__displayTracking || child.tracking_number)}</div>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="design-table__td shipping-col-status">
                                                <ShipmentStatusBadge status={child.status || master.status} />
                                            </td>

                                            <td className="design-table__td shipping-col-current">
                                                <div className="shipment-current-status shipment-current-status--child" title={childStatusTitle}>
                                                    {childStatusMeta.date ? (
                                                        <span className="shipment-current-status__date">{childStatusMeta.date}</span>
                                                    ) : null}
                                                    <span className="shipment-current-status__headline">{childStatusMeta.headline}</span>
                                                    {childStatusMeta.location ? (
                                                        <span className="shipment-current-status__location">{childStatusMeta.location}</span>
                                                    ) : null}
                                                </div>
                                            </td>

                                            <td className="design-table__td shipping-col-eta">
                                                <div className="shipment-date-cell shipment-date-cell--child">
                                                    {(() => {
                                                        const formatted = formatDateTime(child.eta);
                                                        if (typeof formatted === 'object') return <span className="shipment-date-cell__date">{formatted.datePart}</span>;
                                                        return <span className="shipment-date-cell__date">{formatted || '-'}</span>;
                                                    })()}
                                                </div>
                                            </td>

                                            <td className="design-table__td shipping-col-show-date">
                                                <div className="shipment-date-cell shipment-date-cell--child">
                                                    <span className="shipment-date-cell__date">{formatShowDateDisplay(child.show_date || master.show_date)}</span>
                                                </div>
                                            </td>

                                            <td className="design-table__td shipping-col-carrier">
                                                <span className="carrier-cell carrier-cell--child">{displayValue(child.carrier || master.carrier)}</span>
                                            </td>

                                            <td className="design-table__td shipping-col-route">
                                                <div className="shipment-route-cell shipment-route-cell--child">
                                                    <div className="shipment-route-line">{shortLocation(child.origin)}</div>
                                                    <div className="shipment-route-line">{shortLocation(child.destination)}</div>
                                                </div>
                                            </td>

                                            <td className="design-table__td action-cell shipping-col-actions" onClick={(event) => event.stopPropagation()}>
                                                <div className="action-cell__inner">
                                                    <button
                                                        type="button"
                                                        className="track-btn mini-btn"
                                                        onClick={() => onSelectShipment(toChildSelectionPayload(child, master))}
                                                    >
                                                        Details
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        );
                                    }) : null}
                                </Fragment>
                            );
                        })}
                    </tbody>
                        </table>
                    </div>
                </>
            )}

            {showMobileFilters ? (
                <>
                    <button
                        type="button"
                        className="shipping-mobile-sheet-backdrop"
                        aria-label="Close filters"
                        onClick={() => setShowMobileFilters(false)}
                    />
                    <section className="shipping-mobile-sheet" role="dialog" aria-modal="true" aria-label="Shipment filters">
                        <div className="shipping-mobile-sheet__header">
                            <h3>Filters</h3>
                            <button type="button" className="shipping-mobile-sheet__close" onClick={() => setShowMobileFilters(false)}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="shipping-mobile-sheet__body">
                            <label className="shipping-mobile-sheet__field">
                                <span className="shipping-mobile-sheet__label">Search tracking</span>
                                <input
                                    type="text"
                                    value={idSearch}
                                    onChange={(event) => setIdSearch(event.target.value)}
                                    placeholder="Tracking, items, recipient..."
                                />
                            </label>

                            <div className="shipping-mobile-sheet__group">
                                <div className="shipping-mobile-sheet__label">Status</div>
                                <div className="shipping-mobile-sheet__chips">
                                    {allStatuses.map((status) => (
                                        <button
                                            key={status}
                                            type="button"
                                            className={`shipping-mobile-chip ${statusFilter.includes(status) ? 'is-active' : ''}`}
                                            onClick={() => toggleArrayItem(statusFilter, setStatusFilter, status)}
                                        >
                                            {status}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="shipping-mobile-sheet__group">
                                <div className="shipping-mobile-sheet__label">Carrier</div>
                                <div className="shipping-mobile-sheet__chips">
                                    {allCarriers.map((carrier) => (
                                        <button
                                            key={carrier}
                                            type="button"
                                            className={`shipping-mobile-chip ${carrierFilter.includes(carrier) ? 'is-active' : ''}`}
                                            onClick={() => toggleArrayItem(carrierFilter, setCarrierFilter, carrier)}
                                        >
                                            {carrier}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="shipping-mobile-sheet__group">
                                <div className="shipping-mobile-sheet__label">Exhibition</div>
                                <div className="shipping-mobile-sheet__chips">
                                    {allExhibitions.map((exhibition) => (
                                        <button
                                            key={exhibition}
                                            type="button"
                                            className={`shipping-mobile-chip ${exhibitionFilter.includes(exhibition) ? 'is-active' : ''}`}
                                            onClick={() => toggleArrayItem(exhibitionFilter, setExhibitionFilter, exhibition)}
                                        >
                                            {exhibition}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="shipping-mobile-sheet__footer">
                            <button type="button" className="shipping-mobile-sheet__ghost" onClick={clearAllFilters}>
                                Clear all
                            </button>
                            <button type="button" className="shipping-mobile-sheet__primary" onClick={() => setShowMobileFilters(false)}>
                                Apply
                            </button>
                        </div>
                    </section>
                </>
            ) : null}

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

