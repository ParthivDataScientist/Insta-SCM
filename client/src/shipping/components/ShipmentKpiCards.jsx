import React from 'react';
import { AlertTriangle, CheckCircle, Package, Truck } from 'lucide-react';
import KpiCard from '../../components/app/KpiCard';

const KPI_CONFIG = [
    {
        key: 'all',
        filterValue: 'All',
        icon: Truck,
        label: 'Total Shipments',
        statsKey: 'total',
        className: 'design-dashboard__kpi design-dashboard__kpi--all',
    },
    {
        key: 'transit',
        filterValue: 'Active',
        icon: Package,
        label: 'In Transit',
        statsKey: 'transit',
        tone: 'blue',
        className: 'design-dashboard__kpi design-dashboard__kpi--pending',
    },
    {
        key: 'delivered',
        filterValue: 'Delivered',
        icon: CheckCircle,
        label: 'Delivered',
        statsKey: 'delivered',
        tone: 'green',
        className: 'design-dashboard__kpi design-dashboard__kpi--won',
    },
    {
        key: 'exceptions',
        filterValue: 'Exception',
        icon: AlertTriangle,
        label: 'Exceptions',
        statsKey: 'exceptions',
        tone: 'red',
        className: 'design-dashboard__kpi design-dashboard__kpi--lost',
    },
];

const ShipmentKpiCards = ({ filter, onFilterChange, stats }) => (
    <div className="design-dashboard__kpi-grid">
        {KPI_CONFIG.map((card) => (
            <KpiCard
                key={card.key}
                icon={card.icon}
                label={card.label}
                value={`${stats?.[card.statsKey] ?? 0}`}
                tone={card.tone}
                active={filter === card.filterValue}
                onClick={() => onFilterChange(card.filterValue)}
                className={card.className}
            />
        ))}
    </div>
);

export default ShipmentKpiCards;
