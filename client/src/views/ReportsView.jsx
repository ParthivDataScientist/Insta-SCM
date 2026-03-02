import React from 'react';
import { BarChart3, PieChart } from 'lucide-react';

const ReportsView = ({ stats, shipments }) => {
    // Status distribution
    const total = stats.total || 1;
    const pDelivered = Math.round((stats.delivered / total) * 100);
    const pTransit = Math.round((stats.transit / total) * 100);
    const pException = Math.round((stats.exceptions / total) * 100);

    const pieStyle = {
        background: `conic-gradient(
            #22c55e 0% ${pDelivered}%,
            #3b82f6 ${pDelivered}% ${pDelivered + pTransit}%,
            #ef4444 ${pDelivered + pTransit}% ${pDelivered + pTransit + pException}%,
            #cbd5e1 ${pDelivered + pTransit + pException}% 100%
        )`,
    };

    // Weekly volume — last 7 days
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(today.getDate() - (6 - i));
        return { date: d.toISOString().split('T')[0], dayName: DAYS[d.getDay()], count: 0 };
    });

    shipments.forEach(s => {
        const dateStr = (s.updated_at || s.created_at || '').split('T')[0];
        const day = last7Days.find(d => d.date === dateStr);
        if (day) day.count++;
    });

    const maxCount = Math.max(...last7Days.map(d => d.count), 1);

    return (
        <div>
            <h2 className="view-title" style={{ marginBottom: 24 }}>Performance Analytics</h2>
            <div className="reports-grid">
                {/* Bar Chart */}
                <div className="report-chart-card">
                    <div className="report-chart-header">
                        <h3 className="report-chart-title"><BarChart3 size={18} /> Weekly Activity</h3>
                    </div>
                    <div className="bar-chart">
                        {last7Days.map((d, i) => {
                            const height = (d.count / maxCount) * 100;
                            return (
                                <div key={i} className="bar-wrapper">
                                    <div
                                        className="bar"
                                        style={{ height: `${height}%`, opacity: height === 0 ? 0.2 : 1 }}
                                        title={`${d.count} shipments`}
                                    />
                                    <div className="bar-label">{d.dayName}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Pie Chart */}
                <div className="report-chart-card">
                    <div className="report-chart-header">
                        <h3 className="report-chart-title"><PieChart size={18} /> Status Distribution</h3>
                    </div>
                    <div className="pie-container" style={{ flexDirection: 'column' }}>
                        <div className="pie" style={{ ...pieStyle, border: 'none' }}>
                            <div className="pie-center">
                                <span className="pie-value">{stats.total}</span>
                                <span className="pie-label">Total</span>
                            </div>
                        </div>
                        <div className="pie-legend">
                            <div className="pie-legend-item"><div className="pie-legend-dot" style={{ background: '#22c55e' }} /> Delivered ({stats.delivered})</div>
                            <div className="pie-legend-item"><div className="pie-legend-dot" style={{ background: '#3b82f6' }} /> Transit ({stats.transit})</div>
                            <div className="pie-legend-item"><div className="pie-legend-dot" style={{ background: '#ef4444' }} /> Exception ({stats.exceptions})</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReportsView;
