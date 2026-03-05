import React from 'react';
import { CheckCircle, Truck, AlertTriangle, Clock } from 'lucide-react';

const classify = (s = '') => {
    const v = s.toLowerCase();
    if (v.includes('delivered')) return 'delivered';
    if (v.includes('transit')) return 'in-transit';
    if (v.includes('out for')) return 'out-for-delivery';
    if (v.includes('exception')) return 'exception';
    return 'unknown';
};

const statusLabel = (s = '') => {
    const v = s.toLowerCase();
    if (v.includes('delivered')) return 'Delivered';
    if (v.includes('transit')) return 'In Transit';
    if (v.includes('out for')) return 'Out for Delivery';
    if (v.includes('exception')) return 'Exception';
    return s || 'Unknown';
};

const StatusBadge = ({ status }) => {
    const sType = classify(status);
    const sLabel = statusLabel(status);

    const icons = {
        'delivered': <CheckCircle size={13} />,
        'in-transit': <Truck size={13} />,
        'out-for-delivery': <Truck size={13} />,
        'exception': <AlertTriangle size={13} />,
    };

    return (
        <span className={`status-badge ${sType}`}>
            {icons[sType] || <Clock size={13} />}
            {sLabel}
        </span>
    );
};

export default StatusBadge;
