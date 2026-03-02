import React from 'react';
import { Package, Filter, Search } from 'lucide-react';
import { Loader } from 'lucide-react';
import StatusBadge from './StatusBadge';
import ProgressBar from './ProgressBar';

const ShipmentTable = ({
    shipments,
    filteredShipments,
    loading,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    carrierFilter,
    setCarrierFilter,
    dateFilter,
    setDateFilter,
    onSelectShipment,
    onRefresh,
}) => {
    const hasActiveFilters = carrierFilter !== 'All' || dateFilter !== 'All' || searchQuery !== '';

    const clearFilters = () => {
        setCarrierFilter('All');
        setDateFilter('All');
        setSearchQuery('');
    };

    return (
        <div className="table-container">
            <div className="table-toolbar">
                <div className="filter-tabs">
                    {['All', 'Active', 'Delivered', 'Exception'].map(tab => (
                        <button
                            key={tab}
                            className={`filter-tab ${filter === tab ? 'active' : ''}`}
                            onClick={() => setFilter(tab)}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
                <div className="search-container">
                    <Search size={16} />
                    <input
                        className="search-input"
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="advanced-filters">
                    <select className="filter-select" value={carrierFilter} onChange={e => setCarrierFilter(e.target.value)}>
                        <option value="All">All Carriers</option>
                        <option value="FedEx">FedEx</option>
                        <option value="DHL">DHL</option>
                    </select>
                    <select className="filter-select" value={dateFilter} onChange={e => setDateFilter(e.target.value)}>
                        <option value="All">All Time</option>
                        <option value="Today">Today</option>
                        <option value="Last 7 Days">Last 7 Days</option>
                    </select>
                    {hasActiveFilters && (
                        <button className="btn-text" onClick={clearFilters}>Clear</button>
                    )}
                </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
                {loading ? (
                    <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        <Loader size={32} className="animate-spin" style={{ margin: '0 auto 16px', display: 'block' }} />
                        Loading shipments...
                    </div>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>Tracking ID / Items</th>
                                <th>Status</th>
                                <th>Carrier</th>
                                <th>Show Date</th>
                                <th>Route</th>
                                <th>ETA</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredShipments.map(s => (
                                <ShipmentRow key={s.id} shipment={s} onClick={() => onSelectShipment(s)} />
                            ))}
                        </tbody>
                    </table>
                )}
                {filteredShipments.length === 0 && !loading && (
                    <div className="table-empty">
                        <Package size={48} />
                        <p>{shipments.length === 0 ? 'No shipments tracked yet.' : 'No shipments match your filter.'}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const ShipmentRow = ({ shipment: s, onClick }) => {
    const isRecentDelivery =
        s.status === 'Delivered' &&
        s.updated_at &&
        (new Date() - new Date(s.updated_at)) < 86400000;

    return (
        <tr onClick={onClick} style={{ cursor: 'pointer' }}>
            <td>
                <div className="cell-track">
                    <div className="cell-track-icon"><Package size={20} /></div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div className="cell-track-id">{s.recipient || s.items || 'Package'}</div>
                            {isRecentDelivery && <span className="recent-badge">Recent</span>}
                        </div>
                        <div className="cell-track-items">{s.tracking_number}</div>
                    </div>
                </div>
            </td>
            <td>
                <StatusBadge status={s.status} />
                {s.status !== 'Delivered' && s.progress != null && (
                    <ProgressBar percentage={s.progress} status={s.status} mini />
                )}
            </td>
            <td className="cell-carrier">{s.carrier}</td>
            <td className="cell-eta" style={{ whiteSpace: 'nowrap' }}>{s.show_date || '—'}</td>
            <td>
                <div>
                    <div><span className="cell-route-label">From:</span> <span className="cell-route-value">{s.origin || '—'}</span></div>
                    <div><span className="cell-route-label">To:</span> <span className="cell-route-value">{s.destination || '—'}</span></div>
                </div>
            </td>
            <td className="cell-eta">{s.eta || 'TBD'}</td>
            <td><span className="chevron-icon">›</span></td>
        </tr>
    );
};

export default ShipmentTable;
