import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import ShipmentStatusBadge from './ShipmentStatusBadge';
import {
    displayValue,
    formatLastUpdateLine,
    shortRouteLabel,
} from '../utils/shipmentGrouping';
import { isUpcomingDate } from '../utils/dateFormatters';

const ShipmentMobileCard = ({ group, onSelectShipment, onOpenActions }) => {
    const { master, childRows } = group;

    return (
        <article
            className={`shipment-mobile-card ${isUpcomingDate(master.booking_date) ? 'shipment-mobile-card--upcoming' : ''}`}
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
                    onClick={() => onOpenActions(master)}
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

            <div className="shipment-mobile-card__update" title={formatLastUpdateLine(master)}>
                {formatLastUpdateLine(master)}
            </div>

            <div className="shipment-mobile-card__footer">
                <button type="button" className="shipment-mobile-card__track" onClick={() => onSelectShipment(master)}>
                    Track
                </button>
                <span className="shipment-mobile-card__tracking">{displayValue(master.tracking_number)}</span>
                {childRows.length > 0 ? <span className="shipment-mobile-card__children">+{childRows.length} parcels</span> : null}
            </div>
        </article>
    );
};

export default ShipmentMobileCard;
