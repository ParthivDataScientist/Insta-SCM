import React, { useState } from 'react';
import { X, Truck, Calendar, Clock, AlertTriangle, Trash2, Package } from 'lucide-react';
import StatusBadge from './StatusBadge';
import ProgressBar from './ProgressBar';
import ConfirmDialog from './ConfirmDialog';
import shipmentsService from '../api/shipments';

const formatHistoryDate = (dateStr) => {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        // Feb 11, 2026 • 01:54 PM
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + 
               ' • ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch (e) {
        return dateStr;
    }
};

const ShipmentDetailPanel = ({ shipment, onClose, onDeleted }) => {
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

    return (
        <>
            {confirmOpen && (
                <div className="saas-modal-backdrop" style={{ zIndex: 1100, position: 'absolute' }}>
                    <div className="saas-modal-confirm">
                        <div className="confirm-icon"><AlertTriangle size={24} color="var(--red)" /></div>
                        <h3>Delete Shipment {s.tracking_number}</h3>
                        <p>This action cannot be undone. All transit history will be lost.</p>
                        <div className="confirm-actions">
                            <button className="btn-outline-sm" onClick={() => setConfirmOpen(false)} disabled={deleting}>Cancel</button>
                            <button className="btn-primary-sm btn-danger" onClick={handleDelete} disabled={deleting}>
                                {deleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="panel-overlay saas-theme" style={{ zIndex: 1000, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                <div className="panel-backdrop" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
                <div className="panel saas-modal" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '450px', transform: 'none', borderRadius: '16px 0 0 16px', margin: 0, borderRight: 'none', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div className="saas-modal__header">
                        <div>
                            <div className="saas-eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <span style={{ fontFamily: 'var(--font-mono)' }}>{s.tracking_number}</span>
                                <button className="panel-copy-btn" style={{ background: 'none', border: 'none', color: 'var(--text-accent)', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }} onClick={() => navigator.clipboard.writeText(s.tracking_number)}>COPY</button>
                            </div>
                            <h2 style={{ margin: '0 0 12px 0', fontSize: '24px', color: 'var(--text-primary)', lineHeight: 1.2, fontFamily: 'var(--font-display)' }}>
                                {s.items || s.recipient || 'Package'}
                            </h2>
                            <div className="saas-inline-meta">
                                <StatusBadge status={s.status} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            <button
                                className="premium-icon-button"
                                style={{ color: 'var(--status-exception-text)', background: 'var(--status-exception-bg)' }}
                                onClick={() => setConfirmOpen(true)}
                                disabled={deleting}
                                title="Delete Shipment"
                            >
                                <Trash2 size={20} />
                            </button>
                            <button className="premium-icon-button premium-icon-button--danger" onClick={onClose} title="Close Panel">
                                <X size={24} />
                            </button>
                        </div>
                    </div>

                    {deleteError && (
                        <div style={{
                            background: 'var(--status-exception-bg)',
                            color: 'var(--status-exception-text)',
                            padding: '8px 16px',
                            fontSize: 13,
                        }}>
                            {deleteError}
                        </div>
                    )}

                    <div className="saas-modal__body no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                        {/* Progress */}
                        <div className="progress-section">
                            <div className="progress-label-row">
                                <span className="progress-label">Shipment Progress</span>
                                <span className="progress-percent">{s.progress || 0}%</span>
                            </div>
                            <ProgressBar percentage={s.progress || 0} status={s.status} />
                        </div>

                        {/* Details Grid */}
                        <div className="detail-grid">
                            <div className="detail-cell">
                                <div className="detail-cell-label">Carrier</div>
                                <div className="detail-cell-value"><Truck size={14} /> {s.carrier}</div>
                            </div>
                            <div className="detail-cell">
                                <div className="detail-cell-label">Estimated Delivery</div>
                                <div className="detail-cell-value"><Calendar size={14} /> {s.eta || 'TBD'}</div>
                            </div>
                            <div className="detail-cell full">
                                <div className="detail-cell-label">Exhibition Name</div>
                                <div className="detail-cell-value"><Package size={14} /> {s.exhibition_name || 'N/A'}</div>
                            </div>
                            <div className="detail-cell full">
                                <div className="detail-cell-label">Show Date</div>
                                <div className="detail-cell-value"><Calendar size={14} /> {s.show_date || '—'}</div>
                            </div>
                            <div className="detail-cell full">
                                <div className="detail-cell-label">Recipient</div>
                                <div className="detail-cell-value"><Package size={14} /> {s.recipient || '—'}</div>
                            </div>
                        </div>

                        {/* Route Visual */}
                        <div className="route-visual">
                            <div>
                                <div className="route-point-label">Origin</div>
                                <div className="route-point-city">{originCity}</div>
                                <div className="route-point-state">{originState}</div>
                            </div>
                            <div className="route-line"><Truck size={16} /></div>
                            <div style={{ textAlign: 'right' }}>
                                <div className="route-point-label">Destination</div>
                                <div className="route-point-city">{destCity}</div>
                                <div className="route-point-state">{destState}</div>
                            </div>
                        </div>

                        {/* Timeline */}
                        {Array.isArray(s.history) && s.history.length > 0 && (
                            <div>
                                <h3 className="timeline-title"><Clock size={16} /> History & Updates</h3>
                                <div className="timeline">
                                    {s.history.map((ev, i) => (
                                        <div key={i} className="timeline-event">
                                            <div className={`timeline-dot ${i === 0 ? 'active' : 'inactive'}`} />
                                            <div className="timeline-date">{formatHistoryDate(ev.date)}</div>
                                            <div className="timeline-status">{ev.status}</div>
                                            <div className="timeline-location">{ev.location}</div>
                                            <div className="timeline-desc">{ev.description}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}


                        {/* Support Section */}
                        <div className="help-section">
                            <div className="help-header">
                                <AlertTriangle size={16} />
                                <h3>Need Help with this Parcel?</h3>
                            </div>
                            <p className="help-text">
                                {s.status === 'Exception'
                                    ? 'This shipment has an exception. Contact the carrier for more details.'
                                    : 'If your parcel is stuck or you have questions, contact the carrier directly.'}
                            </p>
                            <div className="support-contacts">
                                {s.carrier === 'FedEx' && (
                                    <div className="support-item">
                                        <span className="support-label">FedEx Support:</span>
                                        <a href="tel:18004633339" className="support-value">1.800.463.3339</a>
                                    </div>
                                )}
                                {s.carrier === 'DHL' && (
                                    <div className="support-item">
                                        <span className="support-label">DHL Express:</span>
                                        <a href="tel:18002255345" className="support-value">1.800.225.5345</a>
                                    </div>
                                )}
                                <div className="support-item">
                                    <span className="support-label">General:</span>
                                    <span className="support-value">Check carrier website for local office.</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default ShipmentDetailPanel;
