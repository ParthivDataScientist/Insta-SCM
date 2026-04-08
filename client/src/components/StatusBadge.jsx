import React from 'react';

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

    return (
        <span className={`status-pill ${sType}`}>
            <span>{sLabel}</span>
        </span>
    );
};

export default StatusBadge;
