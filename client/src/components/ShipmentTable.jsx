import React, { useState, useRef, useEffect, Fragment } from 'react';
import { Package, Filter, Search, ChevronDown, ChevronRight, Check, Trash2, FolderInput } from 'lucide-react';
import { Loader } from 'lucide-react';
import StatusBadge from './StatusBadge';
import ProgressBar from './ProgressBar';
import shipmentsService from '../api/shipments';

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

/* ── Helpers ── */
const formatDateTime = (dateStr) => {
    if (!dateStr || dateStr === 'TBD' || dateStr === '—' || dateStr === 'Unknown' || dateStr === 'Pending') return '—';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        // Feb 11, 2026
        const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        // 01:54 PM
        const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        return { datePart, timePart };
    } catch (e) {
        return dateStr;
    }
};

const FilterPopover = ({ title, isActive, onClear, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef();
    useOnClickOutside(ref, () => setIsOpen(false));

    return (
        <th className="filter-th design-table__th design-table__th--left" ref={ref}>
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

const ShipmentTable = ({ 
    shipments, 
    allShipments, 
    loading, 
    onSelectShipment, 
    onDeleteShipment, 
    onArchiveShipment, 
    onRefreshShipment,
    onTracked,
    selectedIds = [],
    onSelectionChange = () => {},
    onClearFilters = () => {}
}) => {
    // Per-column filter states
    const [idSearch, setIdSearch] = useState('');
    const [exhibitionFilter, setExhibitionFilter] = useState([]);
    const [statusFilter, setStatusFilter] = useState([]);
    const [carrierFilter, setCarrierFilter] = useState([]);

    // Derived unique options for multi-selects based on ALL data
    const allExhibitions = [...new Set(shipments.map(s => s.exhibition_name))].filter(Boolean);
    const allStatuses = [...new Set(shipments.map(s => s.status))].filter(Boolean);
    const allCarriers = [...new Set(shipments.map(s => s.carrier))].filter(Boolean);

    // Apply Filters
    const filteredShipments = shipments.filter(s => {
        // 1. Tracking ID / Items Search
        const searchTarget = `${s.tracking_number} ${s.items} ${s.recipient}`.toLowerCase();
        if (idSearch && !searchTarget.includes(idSearch.toLowerCase())) return false;

        // 2. Exhibition Name Multi-select
        const exName = s.exhibition_name || 'N/A';
        if (exhibitionFilter.length > 0 && !exhibitionFilter.includes(exName) && !exhibitionFilter.includes(s.exhibition_name)) return false;

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

    const handleSelectAll = () => {
        if (selectedIds.length === filteredShipments.length && filteredShipments.length > 0) {
            onSelectionChange([]);
        } else {
            onSelectionChange(filteredShipments.map(s => s.id));
        }
    };

    const handleSelectRow = (e, id) => {
        e.stopPropagation();
        if (selectedIds.includes(id)) {
            onSelectionChange(selectedIds.filter(i => i !== id));
        } else {
            onSelectionChange([...selectedIds, id]);
        }
    };

    return (
        <div className="design-dashboard__table-shell">
            <div style={{ padding: '0 16px', marginBottom: 12, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                {(idSearch || exhibitionFilter.length || statusFilter.length || carrierFilter.length) ? (
                    <button className="btn-outline-sm" onClick={() => {
                        setIdSearch(''); setExhibitionFilter([]); setStatusFilter([]); setCarrierFilter([]);
                        onClearFilters();
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
                    <table className="design-table">
                        <thead>
                            <tr>
                                <th className="design-table__th design-table__th--left" style={{ width: 40, paddingRight: 0 }}>
                                    <div 
                                        className={`custom-checkbox ${selectedIds.length === filteredShipments.length && filteredShipments.length > 0 ? 'checked' : ''}`}
                                        onClick={handleSelectAll}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {selectedIds.length === filteredShipments.length && filteredShipments.length > 0 && <Check size={10} />}
                                    </div>
                                </th>
                                <FilterPopover title="Tracking ID / Items" isActive={!!idSearch} onClear={() => setIdSearch('')}>
                                    <div className="fp-search">
                                        <Search size={14} className="fps-icon" />
                                        <input autoFocus placeholder="Search ID or Items..." value={idSearch} onChange={e => setIdSearch(e.target.value)} />
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

                                <th className="design-table__th design-table__th--left">Current Status</th>

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

                                <th className="design-table__th design-table__th--left">Route</th>
                                <th className="design-table__th design-table__th--left">ETA</th>
                                <th className="design-table__th design-table__th--left">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredShipments.map(s => (
                                <ShipmentRowGroup 
                                    key={s.id} 
                                    shipment={s} 
                                    allShipments={allShipments}
                                    onSelectShipment={onSelectShipment} 
                                    onDeleteShipment={onDeleteShipment} 
                                    onArchiveShipment={onArchiveShipment}
                                    onRefreshShipment={onRefreshShipment}
                                    onTracked={onTracked}
                                    isSelected={selectedIds.includes(s.id)}
                                    onSelectRow={(e) => handleSelectRow(e, s.id)}
                                />
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

const ShipmentRowGroup = ({ 
    shipment: s, 
    allShipments, 
    onSelectShipment, 
    onDeleteShipment, 
    onArchiveShipment, 
    onRefreshShipment,
    onTracked,
    isSelected,
    onSelectRow
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [loadingChild, setLoadingChild] = useState(null);
    const [syncingMaster, setSyncingMaster] = useState(false);
    const hasChildren = s.child_parcels && s.child_parcels.length > 0;
    const canExpand = Boolean(s.is_master || hasChildren);

    useEffect(() => {
        if (hasChildren) {
            setIsExpanded(true);
        }
    }, [hasChildren]);

    const handleTrackChild = async (child) => {
        setLoadingChild(child.tracking_number);
        try {
            const data = await shipmentsService.previewTrackShipment(child.tracking_number);
            // Build a full shipment-shaped object from the live API response
            const progress_map = { 'Delivered': 100, 'Out for Delivery': 80, 'In Transit': 40, 'Exception': 10 };
            const syntheticShipment = {
                id: null,
                tracking_number: child.tracking_number,
                items: 'Child Piece',
                carrier: data.carrier || s.carrier,
                status: data.status || child.status || 'Unknown',
                raw_status: data.raw_status || child.raw_status || '',
                origin: data.origin || child.origin || s.origin,
                destination: data.destination || child.destination || s.destination,
                eta: data.eta || child.eta || s.eta,
                exhibition_name: s.exhibition_name,
                show_date: s.show_date,
                recipient: s.recipient,
                progress: progress_map[data.status] ?? (progress_map[child.status] ?? 0),
                history: data.history || [],
                child_parcels: [],
                child_tracking_numbers: [],
                is_master: false,
                master_tracking_number: s.tracking_number,
                created_at: s.created_at,
            };
            onSelectShipment(syntheticShipment);
        } catch (err) {
            alert(`Could not load details: ${err.message}`);
        } finally {
            setLoadingChild(null);
        }
    };

    const handleToggleChildren = async (e) => {
        e.stopPropagation();

        if (hasChildren) {
            setIsExpanded(prev => !prev);
            return;
        }

        if (!s.is_master || !onRefreshShipment) {
            return;
        }

        setSyncingMaster(true);
        try {
            await onRefreshShipment([s.id]);
        } catch (err) {
            alert(err.message || 'Could not load child packages');
        } finally {
            setSyncingMaster(false);
        }
    };

    return (
        <Fragment>
            <tr onClick={() => onSelectShipment(s)} style={{ cursor: 'pointer' }} className={`design-table__row ${isSelected ? 'row-selected' : ''}`}>
                <td onClick={onSelectRow}>
                    <div className={`custom-checkbox ${isSelected ? 'checked' : ''}`}>
                        {isSelected && <Check size={10} />}
                    </div>
                </td>
                <td>
                    <div className="tid-cell">
                        {canExpand && (
                            <div 
                                className="child-nav" 
                                onClick={handleToggleChildren}
                                title={hasChildren ? 'Show child packages' : 'Sync child packages'}
                            >
                                {syncingMaster ? <Loader size={14} className="animate-spin" /> : (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                            </div>
                        )}
                        <div className="tid-icon"><Package size={14} /></div>
                        <div>
                    <div className="tid-name">{s.items && s.items !== 'Package' ? s.items : (s.recipient || 'Shipment')}</div>
                    <div className="tid-num">
                        {s.tracking_number}
                                {hasChildren && (
                                    <span style={{ marginLeft: 6, fontSize: 10, background: '#e2f2ff', color: '#0066cc', padding: '2px 6px', borderRadius: 10, fontWeight: 600 }}>
                                        📦 +{s.child_parcels.length} Child
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </td>

                <td>
                    <StatusBadge status={s.status} />
                    {s.status !== 'Delivered' && s.progress != null && (
                        <ProgressBar percentage={s.progress} status={s.status} mini />
                    )}
                </td>
                <td className="current-status-cell">
                    <div className="cs-text" title={s.history && s.history.length > 0 ? (s.history[0].location || s.history[0].description) : s.status}>
                        {(() => {
                            if (s.history && s.history.length > 0) {
                                const latest = s.history[0];
                                let h_date = "";
                                try {
                                    const dt = new Date(latest.date);
                                    if (!isNaN(dt)) {
                                        h_date = dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');
                                    } else {
                                        h_date = latest.date.substring(0, 10);
                                    }
                                } catch(e) {
                                    h_date = latest.date.substring(0, 10);
                                }
                                const loc = latest.location || latest.description || s.status;
                                return `${h_date} : ${loc}`;
                            } else if (s.last_scan_date) {
                                return `${s.last_scan_date} : ${s.status}`;
                            }
                            return s.status;
                        })()}
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
                <td className="eta-cell">
                    {(() => {
                        const formatted = formatDateTime(s.eta);
                        if (typeof formatted === 'object') {
                            return (
                                <div style={{ lineAlpha: 1.2 }}>
                                    <div style={{ fontWeight: 600, color: 'var(--tx)' }}>{formatted.datePart}</div>
                                    <div style={{ fontSize: 11, opacity: 0.8 }}>{formatted.timePart}</div>
                                </div>
                            );
                        }
                        return formatted || 'TBD';
                    })()}
                </td>
                <td className="action-cell" onClick={e => e.stopPropagation()}>
                    <button className="track-btn" onClick={() => onSelectShipment(s)}>Track</button>
                    {onArchiveShipment && (
                        <button className="archive-btn" onClick={e => { e.stopPropagation(); onArchiveShipment(s.id); }} title={s.is_archived ? "Restore to Dashboard" : "Move to Storage"}>
                            {s.is_archived ? "Restore" : "Move"}
                        </button>
                    )}
                    <button className="delete-btn" onClick={e => { e.stopPropagation(); onDeleteShipment(s.id); }} title="Delete shipment">
                        <Trash2 size={14} />
                    </button>
                </td>
            </tr>
            {isExpanded && hasChildren && s.child_parcels.map((child, idx) => (
                <tr 
                    key={`${s.id}-child-${idx}`} 
                    className={`design-table__row child-row clickable-row ${isSelected ? 'row-selected' : ''}`}
                    onClick={() => handleTrackChild(child)}
                    style={{ cursor: 'pointer' }}
                >
                    <td></td> {/* Checkbox placeholder */}
                    <td>
                        <div className="child-indicator">
                            <div className="tid-num" style={{ fontWeight: 600 }}>
                                ↳ {child.tracking_number}
                            </div>
                        </div>
                    </td>

                    <td>
                        <StatusBadge status={child.status} />
                    </td>
                    <td className="current-status-cell">
                        <div className="cs-text" title={child.raw_status || child.status}>
                            {(() => {
                                if (child.last_date) {
                                    let h_date = "";
                                    try {
                                        const dt = new Date(child.last_date);
                                        if (!isNaN(dt)) {
                                            h_date = dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');
                                        } else {
                                            h_date = child.last_date.substring(0, 10);
                                        }
                                    } catch(e) {
                                        h_date = child.last_date.substring(0, 10);
                                    }
                                    const loc = child.last_location || child.raw_status || child.status;
                                    return `${h_date} : ${loc}`;
                                }
                                
                                const c_status = child.raw_status || child.status || "Unknown";
                                if ((!child.last_location || c_status.toLowerCase() === 'in transit') && s.history && s.history.length > 0) {
                                    const latest = s.history[0];
                                    let h_date = "";
                                    try {
                                        const dt = new Date(latest.date);
                                        if (!isNaN(dt)) {
                                            h_date = dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');
                                        } else {
                                            h_date = latest.date.substring(0, 10);
                                        }
                                    } catch(e) {
                                        h_date = latest.date.substring(0, 10);
                                    }
                                    const loc = latest.location || latest.description || c_status;
                                    return `${h_date} : ${loc}`;
                                }
                                return child.raw_status || child.status || "Unknown";
                            })()}
                        </div>
                    </td>
                    <td className="carrier-cell" style={{ opacity: 0.7 }}>{s.carrier || '—'}</td>
                    <td style={{ opacity: 0.7 }}>
                        {child.origin ? (
                            <div className="route-mini">
                                <span className="rm-label">FROM </span>{child.origin.split(',')[0]}<br />
                                <span className="rm-label">TO </span>{child.destination.split(',')[0]}
                            </div>
                        ) : (
                            <div className="route-mini" style={{ opacity: 0.5 }}>
                                <span className="rm-label">FROM </span>{(s.origin || '').split(',')[0]}<br />
                                <span className="rm-label">TO </span>{(s.destination || '').split(',')[0]}
                                <div style={{ fontSize: 9 }}>(Inherited)</div>
                            </div>
                        )}
                    </td>
                    <td className="eta-cell" style={{ opacity: 0.7 }}>
                        {(() => {
                            const formatted = formatDateTime(child.eta || s.eta);
                            if (typeof formatted === 'object') {
                                return (
                                    <div style={{ lineAlpha: 1.2 }}>
                                        <div style={{ fontWeight: 600, color: 'var(--tx)' }}>{formatted.datePart}</div>
                                        <div style={{ fontSize: 11 }}>{formatted.timePart}</div>
                                    </div>
                                );
                            }
                            return formatted || 'TBD';
                        })()}
                    </td>
                    <td className="action-cell" onClick={e => e.stopPropagation()}>
                        <button 
                            className="track-btn piece-btn" 
                            disabled={loadingChild === child.tracking_number}
                            onClick={() => handleTrackChild(child)}
                            style={{ padding: '4px 8px', fontSize: '11px', background: 'var(--red)', color: '#fff', minWidth: 52 }}
                        >
                            {loadingChild === child.tracking_number ? '...' : 'Track'}
                        </button>
                    </td>
                </tr>
            ))}
        </Fragment>
    );
};

export default ShipmentTable;
