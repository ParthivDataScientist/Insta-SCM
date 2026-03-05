import React, { useState, useRef, useEffect } from 'react';
import { Package, Filter, Search, ChevronDown, Check, Trash2 } from 'lucide-react';
import { Loader } from 'lucide-react';
import StatusBadge from './StatusBadge';
import ProgressBar from './ProgressBar';

// Custom Hook for clicking outside popovers
function useOnClickOutside(ref, handler) {
    useEffect(() => {
        const listener = (event) => {
            if (!ref.current || ref.current.contains(event.target)) return;
            handler(event);
        };
        document.addEventListener('mousedown', listener);
        document.addEventListener('touchstart', listener);
        return () => {
            document.removeEventListener('mousedown', listener);
            document.removeEventListener('touchstart', listener);
        };
    }, [ref, handler]);
}

const FilterPopover = ({ title, isActive, onClear, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef();
    useOnClickOutside(ref, () => setIsOpen(false));

    return (
        <th className="filter-th" ref={ref}>
            <div className="th-content" onClick={() => setIsOpen(!isOpen)}>
                {title}
                <div className={`filter-icon-wrapper ${isActive ? 'active' : ''}`}>
                    <Filter size={13} />
                    <ChevronDown size={12} className={`chevron ${isOpen ? 'open' : ''}`} />
                </div>
            </div>
            {isOpen && (
                <div className="filter-popover" onClick={e => e.stopPropagation()}>
                    <div className="fp-header">
                        <span className="fp-title">Filter {title}</span>
                        {isActive && <button className="fp-clear" onClick={() => { onClear(); setIsOpen(false); }}>Clear</button>}
                    </div>
                    <div className="fp-body">
                        {children}
                    </div>
                </div>
            )}
        </th>
    );
};

const ShipmentTable = ({ shipments, loading, onSelectShipment, onDeleteShipment }) => {
    // Per-column filter states
    const [idSearch, setIdSearch] = useState('');
    const [exhibitionSearch, setExhibitionSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState([]);
    const [carrierFilter, setCarrierFilter] = useState([]);

    // Derived unique options for multi-selects based on ALL data
    const allStatuses = [...new Set(shipments.map(s => s.status))].filter(Boolean);
    const allCarriers = [...new Set(shipments.map(s => s.carrier))].filter(Boolean);

    // Apply Filters
    const filteredShipments = shipments.filter(s => {
        // 1. Tracking ID / Items Search
        const searchTarget = `${s.tracking_number} ${s.items} ${s.recipient}`.toLowerCase();
        if (idSearch && !searchTarget.includes(idSearch.toLowerCase())) return false;

        // 2. Exhibition Name Search
        const exName = (s.exhibition_name || '').toLowerCase();
        if (exhibitionSearch && !exName.includes(exhibitionSearch.toLowerCase())) return false;

        // 3. Status Multi-select
        if (statusFilter.length > 0 && !statusFilter.includes(s.status)) return false;

        // 4. Carrier Multi-select
        if (carrierFilter.length > 0 && !carrierFilter.includes(s.carrier)) return false;

        return true;
    });

    // Checkbox toggle helper
    const toggleArrayItem = (array, setArray, item) => {
        if (array.includes(item)) {
            setArray(array.filter(i => i !== item));
        } else {
            setArray([...array, item]);
        }
    };

    return (
        <div className="table-container">
            <div style={{ padding: '0 16px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--tx2)', fontWeight: 500 }}>
                    Showing {filteredShipments.length} of {shipments.length} shipments
                </span>
                {(idSearch || exhibitionSearch || statusFilter.length || carrierFilter.length) ? (
                    <button className="btn-outline-sm" onClick={() => {
                        setIdSearch(''); setExhibitionSearch(''); setStatusFilter([]); setCarrierFilter([]);
                    }}>Clear All Filters</button>
                ) : null}
            </div>

            <div style={{ overflowX: 'auto', paddingBottom: 100 }}> {/* Padding for deep popovers */}
                {loading ? (
                    <div style={{ padding: 60, textAlign: 'center', color: 'var(--tx3)' }}>
                        <Loader size={32} className="animate-spin" style={{ margin: '0 auto 16px', display: 'block' }} />
                        Loading shipments...
                    </div>
                ) : (
                    <table className="tracking-table advanced-table">
                        <thead>
                            <tr>
                                <FilterPopover title="Tracking ID / Items" isActive={!!idSearch} onClear={() => setIdSearch('')}>
                                    <div className="fp-search">
                                        <Search size={14} className="fps-icon" />
                                        <input autoFocus placeholder="Search ID or Items..." value={idSearch} onChange={e => setIdSearch(e.target.value)} />
                                    </div>
                                </FilterPopover>

                                <FilterPopover title="Exhibition" isActive={!!exhibitionSearch} onClear={() => setExhibitionSearch('')}>
                                    <div className="fp-search">
                                        <Search size={14} className="fps-icon" />
                                        <input autoFocus placeholder="Search Exhibition Name..." value={exhibitionSearch} onChange={e => setExhibitionSearch(e.target.value)} />
                                    </div>
                                </FilterPopover>

                                <FilterPopover title="Status" isActive={statusFilter.length > 0} onClear={() => setStatusFilter([])}>
                                    <div className="fp-check-list">
                                        {allStatuses.length === 0 ? <div className="fp-empty">No data</div> : allStatuses.map(st => (
                                            <label key={st} className="fp-check-item">
                                                <div className={`custom-checkbox ${statusFilter.includes(st) ? 'checked' : ''}`}>
                                                    {statusFilter.includes(st) && <Check size={10} />}
                                                </div>
                                                <input type="checkbox" style={{ display: 'none' }} checked={statusFilter.includes(st)} onChange={() => toggleArrayItem(statusFilter, setStatusFilter, st)} />
                                                <span className="fp-label">{st}</span>
                                            </label>
                                        ))}
                                    </div>
                                </FilterPopover>

                                <FilterPopover title="Carrier" isActive={carrierFilter.length > 0} onClear={() => setCarrierFilter([])}>
                                    <div className="fp-check-list">
                                        {allCarriers.length === 0 ? <div className="fp-empty">No data</div> : allCarriers.map(cr => (
                                            <label key={cr} className="fp-check-item">
                                                <div className={`custom-checkbox ${carrierFilter.includes(cr) ? 'checked' : ''}`}>
                                                    {carrierFilter.includes(cr) && <Check size={10} />}
                                                </div>
                                                <input type="checkbox" style={{ display: 'none' }} checked={carrierFilter.includes(cr)} onChange={() => toggleArrayItem(carrierFilter, setCarrierFilter, cr)} />
                                                <span className="fp-label">{cr}</span>
                                            </label>
                                        ))}
                                    </div>
                                </FilterPopover>

                                <th>Current Status</th>
                                <th>Carrier</th>
                                <th>Route</th>
                                <th>ETA</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredShipments.map(s => (
                                <ShipmentRow key={s.id} shipment={s} onClick={() => onSelectShipment(s)} onDeleteShipment={onDeleteShipment} />
                            ))}
                        </tbody>
                    </table>
                )}
                {filteredShipments.length === 0 && !loading && (
                    <div className="table-empty" style={{ padding: '60px 20px', textAlign: 'center' }}>
                        <Package size={48} style={{ color: 'var(--tx3)', margin: '0 auto 16px', opacity: 0.5 }} />
                        <p style={{ color: 'var(--tx2)' }}>{shipments.length === 0 ? 'No shipments tracked yet.' : 'No shipments match your filters.'}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const ShipmentRow = ({ shipment: s, onClick, onDeleteShipment }) => {
    return (
        <tr onClick={onClick} style={{ cursor: 'pointer' }}>
            <td>
                <div className="tid-cell">
                    <div className="tid-icon"><Package size={14} /></div>
                    <div>
                        <div className="tid-name">{s.items && s.items !== 'Package' ? s.items : (s.recipient || 'Shipment')}</div>
                        <div className="tid-num">{s.tracking_number}</div>
                    </div>
                </div>
            </td>
            <td style={{ fontWeight: 600, color: 'var(--tx)' }}>
                {s.exhibition_name || 'N/A'}
            </td>
            <td>
                <StatusBadge status={s.status} />
                {s.status !== 'Delivered' && s.progress != null && (
                    <ProgressBar percentage={s.progress} status={s.status} mini />
                )}
            </td>
            <td className="current-status-cell">
                <div className="cs-text" title={s.history && s.history.length > 0 ? s.history[0].description : s.status}>
                    {s.history && s.history.length > 0 ? s.history[0].description : s.status}
                </div>
            </td>
            <td className="carrier-cell">{s.carrier || '—'}</td>
            <td>
                {s.origin ? (
                    <div className="route-mini">
                        <span className="rm-label">FROM </span>{s.origin.split(',')[0]}<br />
                        <span className="rm-label">TO </span>{s.destination.split(',')[0]}
                    </div>
                ) : '—'}
            </td>
            <td className="eta-cell">{s.eta || 'TBD'}</td>
            <td className="action-cell" onClick={e => e.stopPropagation()}>
                <button className="track-btn" onClick={onClick}>Track</button>
                <button className="delete-btn" onClick={e => { e.stopPropagation(); onDeleteShipment(s.id); }} title="Delete shipment">
                    <Trash2 size={14} />
                </button>
            </td>
        </tr>
    );
};

export default ShipmentTable;
