import React, { useState } from 'react';
import { X, Truck, Calendar, Clock, AlertTriangle, Trash2, Package, MapPin, Info, Phone, ExternalLink, Copy } from 'lucide-react';
import StatusBadge from './StatusBadge';
import ProgressBar from './ProgressBar';
import shipmentsService from '../api/shipments';

const formatHistoryDate = (dateStr) => {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + 
               ' • ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch (e) {
        return dateStr;
    }
};

const ShipmentDetailPanel = ({ shipment, onClose, onDeleted, isPanel = false }) => {
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        setDeleting(true);
        setDeleteError('');
        try {
            await shipmentsService.deleteShipment(shipment.id);
            setConfirmOpen(false);
            onDeleted();
            onClose();
        } catch (err) {
            setDeleteError(`Failed to delete: ${err.message}`);
        } finally {
            setDeleting(false);
        }
    };

    const s = shipment;
    const originCity = (s.origin || 'N/A').split(',')[0];
    const originState = (s.origin || '').split(',')[1] || '';
    const destCity = (s.destination || 'N/A').split(',')[0];
    const destState = (s.destination || '').split(',')[1] || '';

    // If not in panel mode, wrap with legacy overlay (though we prefer panel mode now)
    const content = (
        <div className="shipment-detail-content no-scrollbar">
            {/* Route & Location Section (Promoted to top) */}

            {/* 2. Route & Location Section */}
            <div className="shipment-detail-section">
                <div className="section-header">
                    <MapPin size={16} />
                    <h4>Route & Logistics</h4>
                </div>
                <div className="route-visual premium-route-card">
                    <div className="route-point">
                        <span className="rp-label">Origin</span>
                        <span className="rp-city">{originCity}</span>
                        <span className="rp-state">{originState}</span>
                    </div>
                    <div className="route-connector">
                        <div className="route-line" />
                        <Truck size={14} className="route-icon" />
                    </div>
                    <div className="route-point" style={{ textAlign: 'right' }}>
                        <span className="rp-label">Destination</span>
                        <span className="rp-city">{destCity}</span>
                        <span className="rp-state">{destState}</span>
                    </div>
                </div>

                <div className="logistics-grid">
                    <div className="logistics-item">
                        <Package size={14} />
                        <div>
                            <label>Exhibition</label>
                            <span>{s.exhibition_name || 'N/A'}</span>
                        </div>
                    </div>
                    <div className="logistics-item">
                        <Calendar size={14} />
                        <div>
                            <label>Show Date / Info</label>
                            <span>{s.show_date || '—'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Tracking Timeline */}
            <div className="shipment-detail-section">
                <div className="section-header">
                    <Clock size={16} />
                    <h4>Tracking Status History</h4>
                </div>
                {Array.isArray(s.history) && s.history.length > 0 ? (
                    <div className="premium-timeline">
                        {s.history.map((ev, i) => (
                            <div key={i} className="timeline-item">
                                <div className="timeline-marker">
                                    <div className={`timeline-dot ${i === 0 ? 'is-active' : ''}`} />
                                    {i !== s.history.length - 1 && <div className="timeline-connector" />}
                                </div>
                                <div className="timeline-content">
                                    <div className="timeline-time">{formatHistoryDate(ev.date)}</div>
                                    <div className="timeline-status">{ev.status}</div>
                                    {ev.location && <div className="timeline-location"><MapPin size={10} /> {ev.location}</div>}
                                    {ev.description && <div className="timeline-desc">{ev.description}</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">No history recorded yet.</div>
                )}
            </div>

            {/* 4. Support Section */}
            <div className="support-cta">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <AlertTriangle size={16} color="#f59e0b" />
                    <h5 style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>Need Assistance?</h5>
                </div>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 12px 0' }}>
                    Contact the carrier directly for real-time adjustments or claims.
                </p>
                <div className="support-buttons">
                    {s.carrier === 'FedEx' && (
                        <a href="tel:18004633339" className="support-btn">
                            <Phone size={14} /> Call FedEx
                        </a>
                    )}
                    <button className="support-btn secondary" onClick={() => setConfirmOpen(true)}>
                        <Trash2 size={14} /> Delete Entry
                    </button>
                </div>
            </div>

            {confirmOpen && (
                <div className="confirm-overlay">
                    <div className="confirm-card">
                        <h3>Delete Shipment?</h3>
                        <p>This will permanently remove tracking history for <strong>{s.tracking_number}</strong>.</p>
                        <div className="confirm-actions">
                            <button className="c-btn-cancel" onClick={() => setConfirmOpen(false)}>Cancel</button>
                            <button className="c-btn-delete" onClick={handleDelete} disabled={deleting}>
                                {deleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    if (isPanel) return content;

    return (
        <div className="legacy-modal-overlay">
            <div className="legacy-modal-backdrop" onClick={onClose} />
            <div className="legacy-modal-content">
                <div className="modal-header">
                    <h2>Shipment Details</h2>
                    <button onClick={onClose}><X size={20} /></button>
                </div>
                {content}
            </div>
        </div>
    );
};

export default ShipmentDetailPanel;
