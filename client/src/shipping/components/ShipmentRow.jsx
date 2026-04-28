import React, { Fragment } from 'react';
import { Check, ChevronRight, Package, Trash2 } from 'lucide-react';
import ShipmentStatusBadge from './ShipmentStatusBadge';
import ProgressBar from './ProgressBar';
import {
    displayValue,
    getCurrentStatusMeta,
    readParentTrackingNumber,
    shortLocation,
} from '../utils/shipmentGrouping';
import {
    formatDateTime,
    formatShowDateDisplay,
    isUpcomingDate,
} from '../utils/dateFormatters';

const isUpcomingBookingDate = isUpcomingDate;

const GENERIC_SHIPMENT_LABELS = new Set(['', 'package', 'child package', 'shipment']);

const resolveShipmentLabel = (shipment, fallback = 'Shipment') => {
    const candidates = [
        shipment?.items,
        shipment?.recipient,
        shipment?.project_client_name,
        shipment?.exhibition_name,
    ];

    for (const candidate of candidates) {
        const value = String(candidate || '').trim();
        if (!GENERIC_SHIPMENT_LABELS.has(value.toLowerCase())) {
            return value;
        }
    }

    return fallback;
};

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

const renderDateCell = (value, className = 'shipment-date-cell') => {
    const formatted = formatDateTime(value);
    if (typeof formatted === 'object') {
        return (
            <div className={className}>
                <span className="shipment-date-cell__date">{formatted.datePart}</span>
                <span className="shipment-date-cell__time">{formatted.timePart}</span>
            </div>
        );
    }

    return (
        <div className={className}>
            <span className="shipment-date-cell__date">{formatted || '-'}</span>
        </div>
    );
};

const ShipmentRow = ({
    group,
    isExpanded,
    selectedIds,
    onToggleExpanded,
    onSelectShipment,
    onDeleteShipment,
    onArchiveShipment,
    onSelectMaster,
}) => {
    const { master, childRows, masterKey } = group;
    const masterHasUpcomingShow = isUpcomingDate(master.show_date);
    const masterHasUpcomingBooking = isUpcomingBookingDate(master.booking_date);
    const masterStatusMeta = getCurrentStatusMeta(master);
    const masterStatusTitle = [masterStatusMeta.date, masterStatusMeta.headline, masterStatusMeta.location]
        .filter(Boolean)
        .join(' | ');

    return (
        <Fragment>
            <tr
                className={`design-table__row shipping-row ${selectedIds.includes(master.id) ? 'shipping-row--selected' : ''} ${masterHasUpcomingShow ? 'shipping-row--upcoming-show' : ''} ${masterHasUpcomingBooking ? 'shipping-row--upcoming-booking' : ''}`}
                onClick={() => onSelectShipment(master)}
            >
                <td className="design-table__td shipping-col-check">
                    <button
                        type="button"
                        className={`custom-checkbox ${selectedIds.includes(master.id) ? 'checked' : ''}`}
                        onClick={(event) => onSelectMaster(event, master.id)}
                    >
                        {selectedIds.includes(master.id) ? <Check size={10} /> : null}
                    </button>
                </td>

                <td className="design-table__td shipping-col-id">
                    <div className="shipment-main-cell">
                        {childRows.length > 0 ? (
                            <button type="button" className="child-nav" onClick={(event) => onToggleExpanded(event, masterKey)}>
                                <ChevronRight size={14} className={isExpanded ? 'rotate-90' : ''} />
                            </button>
                        ) : (
                            <span className="shipment-nav-spacer" />
                        )}
                        <span className="tid-icon">
                            <Package size={14} />
                        </span>
                        <div className="shipment-main-cell__content truncate-cell">
                            <div className="tid-name">{resolveShipmentLabel(master)}</div>
                            <div className="tid-num">{displayValue(master.tracking_number)}</div>
                        </div>
                        {childRows.length > 0 ? <span className="shipment-child-count">+{childRows.length}</span> : null}
                    </div>
                </td>

                <td className="design-table__td shipping-col-status">
                    <ShipmentStatusBadge status={master.status} />
                </td>

                <td className="design-table__td shipping-col-current">
                    <div className="shipment-current-status" title={masterStatusTitle}>
                        {masterStatusMeta.date ? <span className="shipment-current-status__date">{masterStatusMeta.date}</span> : null}
                        <span className="shipment-current-status__headline">{masterStatusMeta.headline}</span>
                        {masterStatusMeta.location ? <span className="shipment-current-status__location">{masterStatusMeta.location}</span> : null}
                        <ProgressBar percentage={master.progress} status={master.status} mini />
                    </div>
                </td>

                <td className="design-table__td shipping-col-eta">{renderDateCell(master.eta)}</td>
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
                const childHasUpcomingShow = isUpcomingDate(child.show_date || master.show_date);
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
                                    <div className="tid-name child-name">{resolveShipmentLabel(child, resolveShipmentLabel(master, 'Child Package'))}</div>
                                    <div className="tid-num">{displayValue(child.__displayTracking || child.tracking_number)}</div>
                                </div>
                            </div>
                        </td>

                        <td className="design-table__td shipping-col-status">
                            <ShipmentStatusBadge status={child.status || master.status} />
                        </td>

                        <td className="design-table__td shipping-col-current">
                            <div className="shipment-current-status shipment-current-status--child" title={childStatusTitle}>
                                {childStatusMeta.date ? <span className="shipment-current-status__date">{childStatusMeta.date}</span> : null}
                                <span className="shipment-current-status__headline">{childStatusMeta.headline}</span>
                                {childStatusMeta.location ? <span className="shipment-current-status__location">{childStatusMeta.location}</span> : null}
                            </div>
                        </td>

                        <td className="design-table__td shipping-col-eta">{renderDateCell(child.eta, 'shipment-date-cell shipment-date-cell--child')}</td>
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
};

export default ShipmentRow;
