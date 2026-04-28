import React from 'react';
import { CheckCircle, Truck, AlertTriangle, Clock } from 'lucide-react';
import { normalizeShipmentStatus } from '../utils/shipmentStatusMapper';
import { SHIPMENT_STATUS } from '../constants/shipmentStatus';

const ShipmentStatusBadge = ({ status }: { status: string }) => {
    const normalizedStatus = normalizeShipmentStatus(status);

    const config = {
        [SHIPMENT_STATUS.DELIVERED]: {
            icon: <CheckCircle size={13} />,
            tone: 'design-table__status-pill--won'
        },
        [SHIPMENT_STATUS.IN_TRANSIT]: {
            icon: <Truck size={13} />,
            tone: 'design-table__status-pill--changes'
        },
        [SHIPMENT_STATUS.OUT_FOR_DELIVERY]: {
            icon: <Truck size={13} />,
            tone: 'design-table__status-pill--changes'
        },
        [SHIPMENT_STATUS.EXCEPTION]: {
            icon: <AlertTriangle size={13} />,
            tone: 'design-table__status-pill--lost'
        },
        [SHIPMENT_STATUS.UNKNOWN]: {
            icon: <Clock size={13} />,
            tone: 'design-table__status-pill--pending'
        }
    };

    const displayConfig = config[normalizedStatus as keyof typeof config] || config[SHIPMENT_STATUS.UNKNOWN];

    return (
        <span className={`design-table__status-pill shipments-status-pill ${displayConfig.tone}`}>
            {displayConfig.icon}
            <span>{normalizedStatus}</span>
        </span>
    );
};

export default ShipmentStatusBadge;
