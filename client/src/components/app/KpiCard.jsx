import React from 'react';

export default function KpiCard({ icon: Icon, label, value, detail, tone = 'neutral', active = false, onClick, className = '' }) {
    return (
        <button
            type="button"
            className={`premium-kpi premium-kpi--${tone}${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
            onClick={onClick}
        >
            <div className="premium-kpi__meta">
                <span className="premium-kpi__label">{label}</span>
                <strong className="premium-kpi__value">{value}</strong>
                {detail ? <span className="premium-kpi__detail">{detail}</span> : null}
            </div>
            {Icon ? (
                <span className="premium-kpi__icon">
                    <Icon size={16} />
                </span>
            ) : null}
        </button>
    );
}
