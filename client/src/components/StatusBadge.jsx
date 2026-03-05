import React from 'react';
import { CheckCircle, Truck, AlertTriangle, Clock } from 'lucide-react';

const classify = (s = '') => {
    const v = s.toLowerCase();
    if (v.includes('delivered')) return 'delivered';
    if (v.includes('transit')) return 'transit';
    if (v.includes('out for')) return 'ofd';
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

    // In the new status-pill design from styles.css, no icons are hardcoded
    // because .status-pill::before provides a CSS ::before pseudo-element dot!
    // But since the user likes the modern icons inside pills, we'll keep the icons
    // but put them next to the styling.
    const icons = {
        'delivered': <CheckCircle size={13} />,
        'transit': <Truck size={13} />,
        'ofd': <Truck size={13} />,
        'exception': <AlertTriangle size={13} />,
        'unknown': <Clock size={13} />,
    };

    return (
        <span className={`status-pill ${sType}`}>
            {icons[sType] || <Clock size={13} />}
            <span style={{ marginLeft: 6 }}>{sLabel}</span>
        </span>
    );
};

export default StatusBadge;
