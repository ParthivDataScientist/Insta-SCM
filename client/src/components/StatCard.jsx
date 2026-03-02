import React from 'react';

const StatCard = ({ title, value, icon: Icon, colorClass }) => (
    <div className="stat-card">
        <div>
            <p className="stat-title">{title}</p>
            <h3 className="stat-value">{value ?? 0}</h3>
        </div>
        <div className={`stat-icon ${colorClass}`}>
            <Icon size={22} />
        </div>
    </div>
);

export default StatCard;
