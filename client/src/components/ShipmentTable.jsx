import React, { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
    Check,
    ChevronDown,
    ChevronRight,
    Filter,
    Loader,
    Package,
    Search,
    Trash2,
} from 'lucide-react';
import StatusBadge from './StatusBadge';
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

const normalizeToken = (value) => String(value ?? '').trim();

const displayValue = (value) => {
    const token = normalizeToken(value);
    return token ? token : '-';
};

const shortLocation = (value) => {
    const token = normalizeToken(value);
    if (!token) return '-';
    return token.split(',')[0].trim();
};

const parseTrackingTokens = (value) => {
    if (Array.isArray(value)) {
        return [...new Set(value.flatMap((entry) => parseTrackingTokens(entry)))];
    }

    const raw = normalizeToken(value);
    if (!raw) return [];

    return [...new Set(
        raw
            .split(/[\n,;|]+/)
            .map((token) => token.trim())
            .filter(Boolean)
            .filter((token) => !['n/a', 'na', 'null', 'undefined', '-'].includes(token.toLowerCase())),
    )];
};

const readChildPackages = (shipment) => (
    parseTrackingTokens(
        shipment?.child_package
        ?? shipment?.child_awb
        ?? shipment?.child_tracking_number
        ?? shipment?.child_tracking_numbers,
    )
);

const formatDateTime = (dateStr) => {
    if (!dateStr || ['TBD', '-', 'Unknown', 'Pending'].includes(dateStr)) return '-';
    try {
        const date = new Date(dateStr);
        if (Number.isNaN(date.getTime())) return dateStr;
        return {
            datePart: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            timePart: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        };
    } catch (_) {
        return dateStr;
    }
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const formatStatusDate = (dateStr) => {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        if (Number.isNaN(date.getTime())) return String(dateStr).slice(0, 10);
        return date
            .toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
            .replace(/\//g, '.');
    } catch (_) {
        return String(dateStr).slice(0, 10);
    }
};

const stripLocationFromDescription = (description, location) => {
    const desc = String(description || '').trim();
    const loc = String(location || '').trim();
    if (!desc || !loc) return desc;

    const escaped = escapeRegExp(loc);
    const patterns = [
        new RegExp(`\\s*@\\s*${escaped}$`, 'i'),
        new RegExp(`\\s+at\\s+${escaped}$`, 'i'),
        new RegExp(`\\s+in\\s+${escaped}$`, 'i'),
        new RegExp(`\\s+${escaped}$`, 'i'),
    ];

    let cleaned = desc;
    patterns.forEach((pattern) => {
        cleaned = cleaned.replace(pattern, '');
    });
    return cleaned.trim().replace(/[,:;.\-]+$/, '').trim();
};

const getCurrentStatusMeta = (shipment) => {
    const history = Array.isArray(shipment?.history) ? shipment.history : [];
    if (history.length > 0) {
        const latest = history[0];
        const eventStatus = String(latest?.status || '').trim();
        const eventDescriptionRaw = String(latest?.description || '').trim();
        const eventLocation = String(latest?.location || '').trim();
        const eventDescription = stripLocationFromDescription(eventDescriptionRaw, eventLocation);
        const dateLabel = formatStatusDate(latest?.date);

        let headline = shipment?.status || '-';
        if (eventStatus && eventDescription) {
            if (eventStatus.toLowerCase() === eventDescription.toLowerCase()) {
                headline = eventStatus;
            } else if (eventDescription.toLowerCase().startsWith(eventStatus.toLowerCase())) {
                headline = eventDescription;
            } else {
                headline = `${eventStatus}: ${eventDescription}`;
            }
        } else if (eventDescription || eventStatus) {
            headline = eventDescription || eventStatus;
        }

        return {
            date: dateLabel,
            headline,
            location: eventLocation,
        };
    }

    const fallbackDate = String(shipment?.last_scan_date || '').trim();
    return {
        date: fallbackDate,
        headline: shipment?.status || '-',
        location: '',
    };
};

const parseShowDate = (showDateValue) => {
    const raw = String(showDateValue ?? '').trim();
    if (!raw) return null;

    const direct = Date.parse(raw);
    if (!Number.isNaN(direct)) {
        const date = new Date(direct);
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    const normalized = raw.replace(/\./g, '/').replace(/-/g, '/');
    const ddmmyyyy = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyy) {
        const day = Number(ddmmyyyy[1]);
        const month = Number(ddmmyyyy[2]) - 1;
        const year = Number(ddmmyyyy[3]);
        const date = new Date(year, month, day);
        if (!Number.isNaN(date.getTime())) return date;
    }

    const yyyymmdd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (yyyymmdd) {
        const year = Number(yyyymmdd[1]);
        const month = Number(yyyymmdd[2]) - 1;
        const day = Number(yyyymmdd[3]);
        const date = new Date(year, month, day);
        if (!Number.isNaN(date.getTime())) return date;
    }

    return null;
};

const isUpcomingShowDate = (showDateValue, windowDays = 20) => {
    const showDate = parseShowDate(showDateValue);
    if (!showDate) return false;
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + windowDays);
    return showDate >= start && showDate <= end;
};

const buildPositionalGroups = (rows = []) => {
    const groups = [];
    let currentGroup = null;

    rows.forEach((row) => {
        if (!row) return;

        const trackingNumber = normalizeToken(row.tracking_number);
        const explicitParent = normalizeToken(row.master_tracking_number);
        const childPackages = readChildPackages(row);

        const rowDeclaresMaster = row.is_master === true;
        const rowDeclaresChild = Boolean(explicitParent || childPackages.length);
        const currentMasterTracking = normalizeToken(currentGroup?.master?.tracking_number);

        const startsNewMaster =
            rowDeclaresMaster
            || !currentGroup
            || (!rowDeclaresChild && trackingNumber && trackingNumber !== currentMasterTracking);

        if (startsNewMaster) {
            currentGroup = { master: row, children: [] };
            groups.push(currentGroup);
            return;
        }

        currentGroup.children.push(row);
    });

    return groups;
};

const expandChildRows = (children, master) => children.flatMap((child, childIndex) => {
    const packages = readChildPackages(child);
    const baseKey = child.id ?? `${master.tracking_number || 'master'}-${childIndex}`;

    if (packages.length <= 1) {
        const resolvedTracking = packages[0] || child.tracking_number;
        return [{
            ...child,
            tracking_number: resolvedTracking,
            __displayTracking: resolvedTracking,
            __sourceChild: child,
            __rowKey: `child-${baseKey}`,
        }];
    }

    return packages.map((pkg, packageIndex) => ({
        ...child,
        tracking_number: pkg,
        __displayTracking: pkg,
        __sourceChild: child,
        __rowKey: `child-${baseKey}-${packageIndex}`,
    }));
});

const buildInlineChildrenFromMaster = (master, masterKey) => {
    const packages = readChildPackages(master);
    if (!packages.length) return [];

    return packages.map((pkg, index) => ({
        ...master,
        tracking_number: pkg,
        __displayTracking: pkg,
        __sourceChild: master,
        __rowKey: `inline-${masterKey}-${index}`,
    }));
};

const toChildSelectionPayload = (child, master) => ({
    ...(child.__sourceChild || child),
    ...child,
    tracking_number: child.__displayTracking || child.tracking_number,
    master_tracking_number: master?.tracking_number || child.master_tracking_number || null,
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

    const matchesTrackingSearch = (row) => {
        const query = idSearch.trim().toLowerCase();
        if (!query) return true;
        const target = `${row.tracking_number || ''} ${row.child_package || ''} ${row.items || ''} ${row.recipient || ''}`.toLowerCase();
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

    return (
        <div className="shipment-table-shell">
            {hasFilters ? (
                <div className="shipment-table-toolbar">
                    <button
                        type="button"
                        className="btn-outline-sm shipment-table-toolbar__clear"
                        onClick={() => {
                            setIdSearch('');
                            setExhibitionFilter([]);
                            setStatusFilter([]);
                            setCarrierFilter([]);
                            onClearFilters();
                        }}
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
                            const masterStatusMeta = getCurrentStatusMeta(master);
                            const masterStatusTitle = [masterStatusMeta.date, masterStatusMeta.headline, masterStatusMeta.location]
                                .filter(Boolean)
                                .join(' | ');

                            return (
                                <Fragment key={masterKey}>
                                    <tr className={`design-table__row shipping-row ${isSelected ? 'shipping-row--selected' : ''} ${masterHasUpcomingShow ? 'shipping-row--upcoming-show' : ''}`} onClick={() => onSelectShipment(master)}>
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
                                                <StatusBadge status={master.status} />
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
                                        </td>
                                    </tr>

                                    {isExpanded ? childRows.map((child) => {
                                        const childHasUpcomingShow = isUpcomingShowDate(child.show_date || master.show_date);
                                        const childStatusMeta = getCurrentStatusMeta(child);
                                        const childStatusTitle = [childStatusMeta.date, childStatusMeta.headline, childStatusMeta.location]
                                            .filter(Boolean)
                                            .join(' | ');
                                        return (
                                        <tr
                                            key={child.__rowKey}
                                            className={`design-table__row shipping-row shipping-row--child ${childHasUpcomingShow ? 'shipping-row--upcoming-show' : ''}`}
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
                                                <StatusBadge status={child.status || master.status} />
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
                                                <button
                                                    type="button"
                                                    className="track-btn mini-btn"
                                                    onClick={() => onSelectShipment(toChildSelectionPayload(child, master))}
                                                >
                                                    Details
                                                </button>
                                            </td>
                                        </tr>
                                        );
                                    }) : null}
                                </Fragment>
                            );
                        })}
                    </tbody>
                </table>
            )}

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

