import React from 'react';
import { CheckCircle, Truck, AlertTriangle, Clock } from 'lucide-react';

const StatusBadge = ({ status }) => {
    const cls = {
        'Delivered': 'delivered',
        'In Transit': 'in-transit',
        'Out for Delivery': 'out-for-delivery',
        'Exception': 'exception',
    }[status] || 'unknown';

    const icons = {
        'Delivered': <CheckCircle size={13} />,
        'In Transit': <Truck size={13} />,
        'Out for Delivery': <Truck size={13} />,
        'Exception': <AlertTriangle size={13} />,
    };

    return (
        <span className={`status-badge ${cls}`}>
            {icons[status] || <Clock size={13} />}
            {status}
        </span>
    );
};

export default StatusBadge;
