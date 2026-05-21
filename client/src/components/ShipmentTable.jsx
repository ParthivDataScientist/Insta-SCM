import React, { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
    Archive,
    Check,
    ChevronDown,
    ChevronRight,
    Copy,
    Eye,
    Filter,
    Loader,
    MoreHorizontal,
    Package,
    Search,
    SlidersHorizontal,
    ArrowUpDown,
    Trash2,
    X,
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
const normalizeTrackingKey = (value) => normalizeToken(value).toUpperCase();

const displayValue = (value) => {
    const token = normalizeToken(value);
    return token ? token : '—';
};

const shortLocation = (value) => {
    const token = normalizeToken(value);
    if (!token) return '—';
    return token.split(',')[0].trim();
};

const shipmentDisplayName = (shipment) => (
    normalizeToken(shipment?.items && shipment.items !== 'Package' ? shipment.items : '')
    || normalizeToken(shipment?.recipient)
    || normalizeToken(shipment?.project_client_name)
    || 'Shipment'
);

const copyToClipboard = async (value) => {
    const token = normalizeToken(value);
    if (!token || !navigator?.clipboard) return;
    await navigator.clipboard.writeText(token);
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

const readFirstToken = (...values) => {
    for (const value of values) {
        const [token] = parseTrackingTokens(value);
        if (token) return token;
    }
    return '';
};

const readParentTrackingNumber = (shipment) => readFirstToken(
    shipment?.master_tracking_number,
    shipment?.masterTrackingNumber,
    shipment?.parent_tracking_number,
    shipment?.parentTrackingNumber,
    shipment?.parent_awb,
    shipment?.parentAwb,
    shipment?.master_awb,
    shipment?.masterAwb,
    shipment?.relationship?.master_tracking_number,
    shipment?.relationship?.parent_tracking_number,
);

const readParcelTrackingNumber = (parcel) => readFirstToken(
    parcel?.tracking_number,
    parcel?.trackingNumber,
    parcel?.trackingNo,
    parcel?.tracking,
    parcel?.awb,
    parcel?.child_awb,
    parcel?.childAwb,
);

const readInlineParcels = (shipment) => {
    const candidates = [
        shipment?.child_parcels,
        shipment?.childPackages,
        shipment?.child_packages,
        shipment?.child_shipments,
        shipment?.childShipments,
        shipment?.children,
        shipment?.pieces,
        shipment?.packages,
    ];

    return candidates.find((value) => Array.isArray(value) && value.length > 0) || [];
};

const readChildPackages = (shipment) => {
    const directTokens = parseTrackingTokens(
        shipment?.child_package
        ?? shipment?.child_awb
        ?? shipment?.child_tracking_number
        ?? shipment?.child_tracking_numbers
        ?? shipment?.childTrackingNumbers
        ?? shipment?.child_awbs,
    );

    const parcelTokens = readInlineParcels(shipment)
        .map((parcel) => readParcelTrackingNumber(parcel))
        .filter(Boolean);

    return [...new Set([...directTokens, ...parcelTokens])];
};

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

const isEmptyStatus = (value) => {
    const token = normalizeToken(value).toLowerCase();
    return !token || ['unknown', 'pending', 'tracking unavailable', 'awaiting child scan'].includes(token);
};

const buildChildScanHistory = (child, master) => {
    const explicitHistory = Array.isArray(child?.history) ? child.history.filter(Boolean) : [];
    if (explicitHistory.length > 0) {
        return explicitHistory;
    }

    const lastDate = normalizeToken(child?.last_date || child?.lastScanDate || child?.last_scan_date);
    const lastLocation = normalizeToken(child?.last_location || child?.lastLocation);
    const rawStatus = normalizeToken(child?.raw_status || child?.current_status || child?.status);
    if (lastDate || lastLocation || (!isEmptyStatus(rawStatus) && rawStatus !== normalizeToken(master?.status))) {
        return [{
            description: rawStatus || 'Child package update',
            location: lastLocation,
            status: normalizeToken(child?.status) || rawStatus,
            date: lastDate,
        }];
    }

    return [];
};

const resolveChildTrackingFields = (child, master) => {
    const history = buildChildScanHistory(child, master);
    const childStatus = normalizeToken(child?.status);
    const masterStatus = normalizeToken(master?.status);
    const childRawStatus = normalizeToken(child?.raw_status || child?.current_status);
    const hasDistinctStatus = !isEmptyStatus(childStatus) && childStatus.toLowerCase() !== masterStatus.toLowerCase();
    const hasDistinctRawStatus = !isEmptyStatus(childRawStatus) && childRawStatus.toLowerCase() !== masterStatus.toLowerCase();
    const status = history.length > 0
        ? (childStatus || history[0]?.status || 'In Transit')
        : (hasDistinctStatus ? childStatus : 'Pending');
    const currentStatus = history.length > 0
        ? (child?.current_status || childRawStatus || history[0]?.description || status)
        : (hasDistinctRawStatus ? childRawStatus : 'Awaiting child scan');

    return {
        history,
        status,
        raw_status: childRawStatus || currentStatus,
        current_status: currentStatus,
        progress: history.length > 0 ? child?.progress : 0,
    };
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
        headline: shipment?.current_status || shipment?.raw_status || shipment?.status || '-',
        location: '',
    };
};

const splitEventHeadline = (headline, fallbackStatus) => {
    const text = normalizeToken(headline);
    const fallback = normalizeToken(fallbackStatus);

    if (!text || text === '-') {
        return {
            status: fallback || 'Status',
            message: '—',
        };
    }

    const dividerIndex = text.indexOf(':');
    if (dividerIndex > 0) {
        const status = text.slice(0, dividerIndex).trim();
        const message = text.slice(dividerIndex + 1).trim();
        return {
            status: status || fallback || 'Status',
            message: message || text,
        };
    }

    if (fallback && text.toLowerCase().startsWith(`${fallback.toLowerCase()}:`)) {
        return {
            status: fallback,
            message: text.slice(fallback.length + 1).trim() || text,
        };
    }

    return {
        status: fallback || 'Status',
        message: text,
    };
};

const parseComparableDate = (dateValue) => {
    const raw = String(dateValue ?? '').trim();
    if (!raw) return null;
    if (['TBD', '-', 'Unknown', 'Pending', 'NA', 'N/A', 'null', 'undefined'].includes(raw)) return null;

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

const parseShowDate = (showDateValue) => parseComparableDate(showDateValue);

const isUpcomingShowDate = (showDateValue, windowDays = 20) => {
    const showDate = parseComparableDate(showDateValue);
    if (!showDate) return false;
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + windowDays);
    return showDate >= start && showDate <= end;
};

const isUpcomingBookingDate = (bookingDateValue, windowDays = 20) => {
    const bookingDate = parseComparableDate(bookingDateValue);
    if (!bookingDate) return false;
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + windowDays);
    return bookingDate >= start && bookingDate <= end;
};

const formatShowDateDisplay = (showDateValue) => {
    const raw = String(showDateValue ?? '').trim();
    if (!raw || ['TBD', '-', 'Unknown', 'Pending'].includes(raw)) return '-';

    const parsed = parseComparableDate(raw);
    if (!parsed) return raw;

    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}.${month}.${year}`;
};

const formatLastUpdateLine = (shipment) => {
    const meta = getCurrentStatusMeta(shipment);
    if (meta.date && meta.headline) return `${meta.date} • ${meta.headline}`;
    return meta.headline || meta.date || 'No recent updates';
};

const shortRouteLabel = (shipment) => {
    const from = shortLocation(shipment?.origin);
    const to = shortLocation(shipment?.destination);
    if (from === '—' && to === '—') return '—';
    return `${from} → ${to}`;
};

const getSortValue = (group, key) => {
    const master = group?.master || {};
    const statusMeta = getCurrentStatusMeta(master);
    switch (key) {
        case 'tracking':
            return `${shipmentDisplayName(master)} ${master.tracking_number || ''}`.toLowerCase();
        case 'status':
            return normalizeToken(master.status).toLowerCase();
        case 'current':
            return `${statusMeta.headline || ''} ${statusMeta.location || ''}`.toLowerCase();
        case 'eta':
            return parseComparableDate(master.eta)?.getTime() || 0;
        case 'showDate':
            return parseComparableDate(master.show_date)?.getTime() || 0;
        case 'carrier':
            return normalizeToken(master.carrier).toLowerCase();
        case 'route':
            return shortRouteLabel(master).toLowerCase();
        default:
            return '';
    }
};

const buildPositionalGroups = (rows = []) => {
    const groups = [];
    const groupsByMasterTracking = new Map();
    const pendingChildren = [];

    const registerMaster = (row, index) => {
        const trackingNumber = normalizeTrackingKey(row?.tracking_number);
        const key = trackingNumber || `row-${index}`;
        const existing = groupsByMasterTracking.get(key);
        if (existing) return existing;

        const group = { master: row, children: [] };
        groupsByMasterTracking.set(key, group);
        groups.push(group);
        return group;
    };

    rows.forEach((row, index) => {
        if (!row) return;

        const trackingNumber = normalizeTrackingKey(row.tracking_number);
        const explicitParent = normalizeTrackingKey(readParentTrackingNumber(row));
        const isChildRow = Boolean(explicitParent && explicitParent !== trackingNumber);

        if (isChildRow) {
            pendingChildren.push({ row, explicitParent, index });
            return;
        }

        registerMaster(row, index);
    });

    pendingChildren.forEach(({ row, explicitParent, index }) => {
        const parentGroup = groupsByMasterTracking.get(explicitParent);
        if (parentGroup) {
            parentGroup.children.push(row);
            return;
        }

        // Keep child rows visible even when parent row is not present in payload.
        registerMaster(row, index);
    });

    return groups;
};

const expandChildRows = (children, master) => children.flatMap((child, childIndex) => {
    const packages = readChildPackages(child);
    const baseKey = child.id ?? `${master.tracking_number || 'master'}-${childIndex}`;
    const childTrackingFields = resolveChildTrackingFields(child, master);

    if (packages.length <= 1) {
        const resolvedTracking = packages[0] || child.tracking_number;
        return [{
            ...child,
            ...childTrackingFields,
            tracking_number: resolvedTracking,
            __displayTracking: resolvedTracking,
            __sourceChild: child,
            __rowKey: `child-${baseKey}`,
        }];
    }

    return packages.map((pkg, packageIndex) => ({
        ...child,
        ...childTrackingFields,
        tracking_number: pkg,
        __displayTracking: pkg,
        __sourceChild: child,
        __rowKey: `child-${baseKey}-${packageIndex}`,
    }));
});

const buildInlineChildrenFromMaster = (master, masterKey) => {
    const parcels = readInlineParcels(master);
    if (parcels.length) {
        return parcels
            .map((parcel, index) => {
                const tracking = readParcelTrackingNumber(parcel);
                if (!tracking) return null;
                const childTrackingFields = resolveChildTrackingFields(parcel, master);

                return {
                    ...master,
                    ...parcel,
                    ...childTrackingFields,
                    origin: parcel?.origin || master.origin,
                    destination: parcel?.destination || master.destination,
                    eta: parcel?.eta || master.eta,
                    tracking_number: tracking,
                    __displayTracking: tracking,
                    __sourceChild: parcel,
                    __rowKey: `inline-${masterKey}-${index}`,
                };
            })
            .filter(Boolean);
    }

    const packages = readChildPackages(master);
    if (!packages.length) return [];

    return packages.map((pkg, index) => ({
        ...master,
        ...resolveChildTrackingFields({}, master),
        tracking_number: pkg,
        __displayTracking: pkg,
        __sourceChild: master,
        __rowKey: `inline-${masterKey}-${index}`,
    }));
};

const toChildSelectionPayload = (child, master) => ({
    ...(child.__sourceChild || child),
    ...child,
    id: child?.__sourceChild?.id ?? (child?.id === master?.id ? null : (child?.id ?? null)),
    history: Array.isArray(child?.history) ? child.history : [],
    tracking_number: child.__displayTracking || child.tracking_number,
    master_tracking_number: master?.tracking_number || readParentTrackingNumber(child) || null,
    is_master: false,
});

const FilterPopover = ({ title, className = '', isActive, onClear, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef();
    useOnClickOutside(ref, () => setIsOpen(false));

    return (
        <th className={`filter-th design-table__th design-table__th--left ${className} ${isActive ? 'is-filtered' : ''}`} ref={ref}>
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

const SortHeader = ({ title, className = '', sortKey, sortConfig, onSort }) => {
    const isActive = sortConfig?.key === sortKey;
    const directionLabel = isActive ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'not sorted';
    return (
        <th className={`design-table__th design-table__th--left ${className}`}>
            <button
                type="button"
                className={`shipment-table__sort-header ${isActive ? 'is-active' : ''}`}
                onClick={() => onSort(sortKey)}
                title={`Sort ${title} (${directionLabel})`}
            >
                <span>{title}</span>
                <ArrowUpDown size={13} />
            </button>
        </th>
    );
};

const RowActionMenu = ({ shipment, onView, onMove, onDelete, canMove = true, align = 'right' }) => {
    const [open, setOpen] = useState(false);
    const [menuStyle, setMenuStyle] = useState(null);
    const ref = useRef(null);
    useOnClickOutside(ref, () => setOpen(false));

    const trackingNumber = shipment?.__displayTracking || shipment?.tracking_number;

    useEffect(() => {
        if (!open) return undefined;

        const updateMenuPosition = () => {
            if (!ref.current) return;

            const rect = ref.current.getBoundingClientRect();
            const menuWidth = 204;
            const menuHeight = canMove ? 166 : 126;
            const gutter = 12;
            const preferredLeft = align === 'left' ? rect.left : rect.right - menuWidth;
            const left = Math.min(
                window.innerWidth - menuWidth - gutter,
                Math.max(gutter, preferredLeft),
            );
            const canOpenBelow = rect.bottom + 8 + menuHeight <= window.innerHeight - gutter;
            const top = canOpenBelow
                ? rect.bottom + 8
                : Math.max(gutter, rect.top - menuHeight - 8);

            setMenuStyle({
                top: `${top}px`,
                left: `${left}px`,
                width: `${menuWidth}px`,
                maxHeight: `${Math.max(112, window.innerHeight - top - gutter)}px`,
            });
        };

        updateMenuPosition();
        window.addEventListener('resize', updateMenuPosition);
        window.addEventListener('scroll', updateMenuPosition, true);

        return () => {
            window.removeEventListener('resize', updateMenuPosition);
            window.removeEventListener('scroll', updateMenuPosition, true);
        };
    }, [align, canMove, open]);

    const runAction = async (action) => {
        await action();
        setOpen(false);
    };

    return (
        <div className={`shipment-row-menu shipment-row-menu--${align}`} ref={ref}>
            <button
                type="button"
                className="shipment-row-menu__trigger"
                aria-label="More shipment actions"
                aria-expanded={open}
                onClick={(event) => {
                    event.stopPropagation();
                    setOpen((current) => !current);
                }}
            >
                <MoreHorizontal size={16} />
            </button>
            {open ? (
                <div className="shipment-row-menu__content" style={menuStyle || undefined} onClick={(event) => event.stopPropagation()}>
                    <button type="button" onClick={() => runAction(onView)}>
                        <Eye size={14} /> View Details
                    </button>
                    {canMove ? (
                        <button type="button" onClick={() => runAction(onMove)}>
                            <Archive size={14} /> {shipment?.is_archived ? 'Restore Shipment' : 'Move Shipment'}
                        </button>
                    ) : null}
                    <button type="button" onClick={() => runAction(() => copyToClipboard(trackingNumber))}>
                        <Copy size={14} /> Copy Tracking ID
                    </button>
                    <button type="button" className="is-danger" onClick={() => runAction(onDelete)}>
                        <Trash2 size={14} /> Delete
                    </button>
                </div>
            ) : null}
        </div>
    );
};

const ShipmentTableSkeleton = () => (
    <>
        {Array.from({ length: 7 }).map((_, rowIndex) => (
            <tr className="design-table__row shipping-row shipment-skeleton-row" key={`shipment-skeleton-${rowIndex}`}>
                <td className="design-table__td shipping-col-check"><span className="shipment-skeleton-box shipment-skeleton-check" /></td>
                <td className="design-table__td shipping-col-id">
                    <div className="shipment-skeleton-line shipment-skeleton-line--wide" />
                    <div className="shipment-skeleton-line shipment-skeleton-line--small" />
                </td>
                <td className="design-table__td shipping-col-status"><div className="shipment-skeleton-pill" /></td>
                <td className="design-table__td shipping-col-current">
                    <div className="shipment-skeleton-line shipment-skeleton-line--wide" />
                    <div className="shipment-skeleton-line shipment-skeleton-line--medium" />
                </td>
                <td className="design-table__td shipping-col-eta"><div className="shipment-skeleton-line shipment-skeleton-line--medium" /></td>
                <td className="design-table__td shipping-col-show-date"><div className="shipment-skeleton-line shipment-skeleton-line--medium" /></td>
                <td className="design-table__td shipping-col-carrier"><div className="shipment-skeleton-line shipment-skeleton-line--small" /></td>
                <td className="design-table__td shipping-col-route">
                    <div className="shipment-skeleton-line shipment-skeleton-line--medium" />
                    <div className="shipment-skeleton-line shipment-skeleton-line--small" />
                </td>
                <td className="design-table__td shipping-col-actions"><div className="shipment-skeleton-actions" /></td>
            </tr>
        ))}
    </>
);

const ShipmentTable = ({
    shipments,
    loading,
    error = '',
    onRetry,
    onImportShipments,
    onBookShipment,
    onSelectShipment,
    onDeleteShipment,
    onArchiveShipment,
    selectedIds = [],
    onSelectionChange = () => {},
    onClearFilters = () => {},
    selectedShipment,
}) => {
    const [idSearch, setIdSearch] = useState('');
    const [exhibitionFilter, setExhibitionFilter] = useState([]);
    const [statusFilter, setStatusFilter] = useState([]);
    const [carrierFilter, setCarrierFilter] = useState([]);
    const [expandedRows, setExpandedRows] = useState(() => new Set());
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    const [mobileActionTarget, setMobileActionTarget] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });

    const handleViewMaster = (shipment) => {
        if (onSelectShipment && shipment) {
            onSelectShipment({ ...shipment, is_master: true });
        }
    };

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

    const sortedGroups = useMemo(() => {
        if (!sortConfig.key) return filteredGroups;
        const direction = sortConfig.direction === 'desc' ? -1 : 1;
        return [...filteredGroups].sort((left, right) => {
            const a = getSortValue(left, sortConfig.key);
            const b = getSortValue(right, sortConfig.key);
            if (typeof a === 'number' || typeof b === 'number') {
                return ((a || 0) - (b || 0)) * direction;
            }
            return String(a).localeCompare(String(b)) * direction;
        });
    }, [filteredGroups, sortConfig]);

    useEffect(() => {
        const validKeys = new Set(sortedGroups.map((group) => group.masterKey));
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
    }, [sortedGroups]);

    const toggleArrayItem = (array, setArray, item) => {
        if (array.includes(item)) {
            setArray(array.filter((entry) => entry !== item));
        } else {
            setArray([...array, item]);
        }
    };

    const visibleMasterIds = sortedGroups
        .map((group) => group.master.id)
        .filter((id) => id != null);
    const allVisibleSelected = visibleMasterIds.length > 0 && visibleMasterIds.every((id) => selectedIds.includes(id));
    const hasFilters = Boolean(idSearch || exhibitionFilter.length || statusFilter.length || carrierFilter.length);
    const tableHasRows = sortedGroups.length > 0;
    const showSkeletonRows = loading && !tableHasRows;

    const handleSort = (key) => {
        setSortConfig((current) => {
            if (current.key !== key) return { key, direction: 'asc' };
            return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
        });
    };

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
            {(hasFilters || selectedIds.length > 0) ? (
                <div className="shipment-table-toolbar">
                    {selectedIds.length > 0 ? (
                        <div className="shipment-table-toolbar__selection">
                            <strong>{selectedIds.length}</strong> shipments selected
                        </div>
                    ) : <span />}
                    {hasFilters ? (
                        <button
                            type="button"
                            className="btn-outline-sm shipment-table-toolbar__clear"
                            onClick={clearAllFilters}
                        >
                            Clear All Filters
                        </button>
                    ) : null}
                </div>
            ) : null}

            {error ? (
                <div className="shipment-table-state shipment-table-state--error">
                    <Package size={36} className="shipment-table-empty__icon" />
                    <h3>Unable to load shipments</h3>
                    <p>Please refresh or try again.</p>
                    {onRetry ? <button type="button" className="shipment-state-btn" onClick={onRetry}>Retry</button> : null}
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
                            {showSkeletonRows ? Array.from({ length: 4 }).map((_, index) => (
                                <article className="shipment-mobile-card shipment-mobile-card--skeleton" key={`mobile-skeleton-${index}`}>
                                    <div className="shipment-skeleton-line shipment-skeleton-line--wide" />
                                    <div className="shipment-skeleton-line shipment-skeleton-line--medium" />
                                    <div className="shipment-skeleton-line shipment-skeleton-line--wide" />
                                </article>
                            )) : sortedGroups.map(({ master, childRows, masterKey }) => (
                                <article
                                    key={`mobile-${masterKey}`}
                                    className={`shipment-mobile-card ${isUpcomingBookingDate(master.booking_date) ? 'shipment-mobile-card--upcoming' : ''}`}
                                    onClick={() => handleViewMaster(master)}
                                >
                                    <div className="shipment-mobile-card__top">
                                        <div className="shipment-mobile-card__title-wrap">
                                            <h3 className="shipment-mobile-card__client">
                                                {master.recipient || master.project_client_name || 'Unknown Client'}
                                            </h3>
                                            <div className="shipment-mobile-card__status">
                                                <StatusBadge status={master.status} />
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="shipment-mobile-card__menu"
                                            aria-label="Shipment actions"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setMobileActionTarget(master);
                                            }}
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
                                            onClick={() => handleViewMaster(master)}
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
                    <colgroup>
                        <col className="shipping-col-check" />
                        <col className="shipping-col-id" />
                        <col className="shipping-col-status" />
                        <col className="shipping-col-current" />
                        <col className="shipping-col-eta" />
                        <col className="shipping-col-show-date" />
                        <col className="shipping-col-carrier" />
                        <col className="shipping-col-route" />
                        <col className="shipping-col-actions" />
                    </colgroup>
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

                            <SortHeader title="Latest Event" className="shipping-col-current" sortKey="current" sortConfig={sortConfig} onSort={handleSort} />
                            <SortHeader title="Date" className="shipping-col-eta" sortKey="eta" sortConfig={sortConfig} onSort={handleSort} />
                            <SortHeader title="Show Date" className="shipping-col-show-date" sortKey="showDate" sortConfig={sortConfig} onSort={handleSort} />

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

                            <SortHeader title="Route" className="shipping-col-route" sortKey="route" sortConfig={sortConfig} onSort={handleSort} />
                            <th className="design-table__th design-table__th--left shipping-col-actions">Actions</th>
                        </tr>
                    </thead>

                    <tbody>
                        {showSkeletonRows ? <ShipmentTableSkeleton /> : sortedGroups.map(({ master, childRows, masterKey }) => {
                            const hasChildren = childRows.length > 0;
                            const isExpanded = expandedRows.has(masterKey);
                            const isSelected = master.id != null && selectedIds.includes(master.id);
                            const masterHasUpcomingShow = isUpcomingShowDate(master.show_date);
                            const masterHasUpcomingBooking = isUpcomingBookingDate(master.booking_date);
                            const masterStatusMeta = getCurrentStatusMeta(master);
                            const masterEventHeadline = splitEventHeadline(masterStatusMeta.headline, master.status);
                            const masterStatusTitle = [masterStatusMeta.date, masterStatusMeta.headline, masterStatusMeta.location]
                                .filter(Boolean)
                                .join(' | ');

                            const isMasterActive = selectedShipment?.id === master.id && selectedShipment?.is_master !== false;

                            return (
                                <Fragment key={masterKey}>
                                    <tr className={`design-table__row shipping-row ${isSelected ? 'shipping-row--selected' : ''} ${masterHasUpcomingShow ? 'shipping-row--upcoming-show' : ''} ${masterHasUpcomingBooking ? 'shipping-row--upcoming-booking' : ''} ${isMasterActive ? 'active-row' : ''}`} onClick={() => handleViewMaster(master)}>
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

                                                <div className="shipment-main-cell__content truncate-cell" title={`${shipmentDisplayName(master)} | ${displayValue(master.tracking_number)}`}>
                                                    <div className="tid-name">{shipmentDisplayName(master)}</div>
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
                                                <div className="shipment-current-status__top">
                                                    <span className="shipment-current-status__badge">{displayValue(masterEventHeadline.status)}</span>
                                                    <span className="shipment-current-status__headline">{masterEventHeadline.message}</span>
                                                </div>
                                                <span className="shipment-current-status__meta">
                                                    {[masterStatusMeta.location, masterStatusMeta.date].filter(Boolean).join(' · ') || '—'}
                                                </span>
                                            </div>
                                        </td>

                                        <td className="design-table__td shipping-col-eta">
                                            <div className="shipment-date-cell">
                                                {masterStatusMeta.date ? (
                                                    <span className="shipment-date-cell__date">{masterStatusMeta.date}</span>
                                                ) : <span className="shipment-date-cell__date">—</span>}
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
                                            <div className="shipment-route-cell" title={shortRouteLabel(master)}>
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
                                                <button type="button" className="track-btn" onClick={() => handleViewMaster(master)}>Track</button>
                                                <RowActionMenu
                                                    shipment={master}
                                                    onView={() => handleViewMaster(master)}
                                                    onMove={() => onArchiveShipment?.(master.id)}
                                                    onDelete={() => onDeleteShipment(master.id)}
                                                    canMove={Boolean(onArchiveShipment && master.id != null)}
                                                />
                                            </div>
                                        </td>
                                    </tr>

                                    {isExpanded ? childRows.map((child) => {
                                        const childHasUpcomingShow = isUpcomingShowDate(child.show_date || master.show_date);
                                        const childHasUpcomingBooking = isUpcomingBookingDate(child.booking_date || master.booking_date);
                                        const childStatusMeta = getCurrentStatusMeta(child);
                                        const childEventHeadline = splitEventHeadline(childStatusMeta.headline, child.status || master.status);
                                        const childStatusTitle = [childStatusMeta.date, childStatusMeta.headline, childStatusMeta.location]
                                            .filter(Boolean)
                                            .join(' | ');
                                        const isChildActive = selectedShipment && 
                                            selectedShipment.is_master === false &&
                                            (selectedShipment.id === child.id || 
                                             selectedShipment.tracking_number === (child.__displayTracking || child.tracking_number));
                                        return (
                                        <tr
                                            key={child.__rowKey}
                                            className={`design-table__row shipping-row shipping-row--child ${childHasUpcomingShow ? 'shipping-row--upcoming-show' : ''} ${childHasUpcomingBooking ? 'shipping-row--upcoming-booking' : ''} ${isChildActive ? 'active-row' : ''}`}
                                            onClick={() => onSelectShipment(toChildSelectionPayload(child, master))}
                                        >
                                            <td className="design-table__td shipping-col-check" />

                                            <td className="design-table__td shipping-col-id">
                                                <div className="shipment-main-cell nested-cell">
                                                    <span className="hierarchy-connector" />
                                                    <span className="tid-icon child-icon">
                                                        <Package size={12} />
                                                    </span>
                                                    <div className="shipment-main-cell__content truncate-cell" title={`${child.items && child.items !== 'Package' ? child.items : 'Child Package'} | ${displayValue(child.__displayTracking || child.tracking_number)}`}>
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
                                                    <div className="shipment-current-status__top">
                                                        <span className="shipment-current-status__badge">{displayValue(childEventHeadline.status)}</span>
                                                        <span className="shipment-current-status__headline">{childEventHeadline.message}</span>
                                                    </div>
                                                    <span className="shipment-current-status__meta">
                                                        {[childStatusMeta.location, childStatusMeta.date].filter(Boolean).join(' · ') || '—'}
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="design-table__td shipping-col-eta">
                                                <div className="shipment-date-cell shipment-date-cell--child">
                                                    <span className="shipment-date-cell__date">{childStatusMeta.date || '—'}</span>
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
                                                <div className="shipment-route-cell shipment-route-cell--child" title={shortRouteLabel(child)}>
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
                                                        Track
                                                    </button>
                                                    <RowActionMenu
                                                        shipment={child}
                                                        onView={() => onSelectShipment(toChildSelectionPayload(child, master))}
                                                        onMove={() => onArchiveShipment?.(child.id)}
                                                        onDelete={() => child.id != null ? onDeleteShipment(child.id) : onDeleteShipment(master.id)}
                                                        canMove={Boolean(onArchiveShipment && child.id != null)}
                                                    />
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
                                    handleViewMaster(mobileActionTarget);
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
                                className="shipping-mobile-action"
                                onClick={async () => {
                                    await copyToClipboard(mobileActionTarget.tracking_number);
                                    setMobileActionTarget(null);
                                }}
                            >
                                <Copy size={16} /> Copy Tracking ID
                            </button>
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

            {sortedGroups.length === 0 && !loading && !error ? (
                <div className="shipment-table-state shipment-table-empty">
                    <Package size={40} className="shipment-table-empty__icon" />
                    <h3>{groupedShipments.length === 0 ? 'No shipments found' : 'No shipments match your filters'}</h3>
                    <p>{groupedShipments.length === 0 ? 'Try changing filters or import shipment data.' : 'Try changing filters or clearing the table search.'}</p>
                    {groupedShipments.length === 0 ? (
                        <div className="shipment-state-actions">
                            {onImportShipments ? <button type="button" className="shipment-state-btn" onClick={onImportShipments}>Import Shipments</button> : null}
                            {onBookShipment ? <button type="button" className="shipment-state-btn shipment-state-btn--primary" onClick={onBookShipment}>Book Shipment</button> : null}
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
};

export default ShipmentTable;

