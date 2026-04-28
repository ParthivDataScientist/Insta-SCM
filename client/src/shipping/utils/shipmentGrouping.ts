import { formatStatusDate } from './dateFormatters';
import type { ShipmentRecord, ShipmentGroup } from '../types/shipment.types';

export const normalizeToken = (value: any): string => String(value ?? '').trim();
export const normalizeTrackingKey = (value: any): string => normalizeToken(value).toUpperCase();

export const displayValue = (value: any): string => {
    const token = normalizeToken(value);
    return token ? token : '-';
};

export const shortLocation = (value: any): string => {
    const token = normalizeToken(value);
    if (!token) return '-';
    return token.split(',')[0].trim();
};

export const parseTrackingTokens = (value: any): string[] => {
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

export const readFirstToken = (...values: any[]): string => {
    for (const value of values) {
        const [token] = parseTrackingTokens(value);
        if (token) return token;
    }
    return '';
};

export const readParentTrackingNumber = (shipment: any): string => readFirstToken(
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

export const readParcelTrackingNumber = (parcel: any): string => readFirstToken(
    parcel?.tracking_number,
    parcel?.trackingNumber,
    parcel?.trackingNo,
    parcel?.tracking,
    parcel?.awb,
    parcel?.child_awb,
    parcel?.childAwb,
);

export const readInlineParcels = (shipment: any): any[] => {
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

export const readChildPackages = (shipment: any): string[] => {
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

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const stripLocationFromDescription = (description: string, location: string): string => {
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

export const getCurrentStatusMeta = (shipment: any): { date: string; headline: string; location: string } => {
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

export const formatLastUpdateLine = (shipment: any): string => {
    const meta = getCurrentStatusMeta(shipment);
    if (meta.date && meta.headline) return `${meta.date} • ${meta.headline}`;
    return meta.headline || meta.date || 'No recent updates';
};

export const shortRouteLabel = (shipment: any): string => {
    const from = shortLocation(shipment?.origin);
    const to = shortLocation(shipment?.destination);
    if (from === '-' && to === '-') return '-';
    return `${from} → ${to}`;
};

export const buildPositionalGroups = (rows: any[] = []): ShipmentGroup[] => {
    const groups: ShipmentGroup[] = [];
    const groupsByMasterTracking = new Map<string, ShipmentGroup>();
    const pendingChildren: { row: any; explicitParent: string; index: number }[] = [];

    const registerMaster = (row: any, index: number) => {
        const trackingNumber = normalizeTrackingKey(row?.tracking_number);
        const key = trackingNumber || `row-${index}`;
        const existing = groupsByMasterTracking.get(key);
        if (existing) return existing;

        const group: ShipmentGroup = { master: row, children: [] };
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

        registerMaster(row, index);
    });

    return groups;
};

export const expandChildRows = (children: any[], master: any): any[] => {
    return children.flatMap((child, childIndex) => {
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
};

export const buildInlineChildrenFromMaster = (master: any, masterKey: string): any[] => {
    const parcels = readInlineParcels(master);
    if (parcels.length) {
        return parcels
            .map((parcel, index) => {
                const tracking = readParcelTrackingNumber(parcel);
                if (!tracking) return null;

                const explicitParcelHistory = Array.isArray(parcel?.history)
                    ? parcel.history.filter(Boolean)
                    : [];
                const parcelHistory = explicitParcelHistory.length > 0
                    ? explicitParcelHistory
                    : ((parcel?.last_date || parcel?.last_location || parcel?.raw_status || parcel?.status)
                        ? [{
                            description: parcel?.raw_status || parcel?.status || master.status || 'Update',
                            location: parcel?.last_location || parcel?.destination || '',
                            status: parcel?.status || parcel?.raw_status || master.status || 'In Transit',
                            date: parcel?.last_date || '',
                        }]
                        : (Array.isArray(master?.history) ? master.history : []));

                return {
                    ...master,
                    ...parcel,
                    history: parcelHistory,
                    status: parcel?.status || master.status,
                    raw_status: parcel?.raw_status || master.raw_status,
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
        tracking_number: pkg,
        __displayTracking: pkg,
        __sourceChild: master,
        __rowKey: `inline-${masterKey}-${index}`,
    }));
};
