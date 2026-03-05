import React, { useState } from 'react';
import { X, Truck, Calendar, Box, Clock, AlertTriangle, Trash2 } from 'lucide-react';
import StatusBadge from './StatusBadge';
import ProgressBar from './ProgressBar';
import ConfirmDialog from './ConfirmDialog';
import { deleteShipment } from '../api';

const ShipmentDetailPanel = ({ shipment, onClose, onDeleted }) => {
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        setDeleting(true);
        setDeleteError('');
        try {
            await deleteShipment(shipment.id);
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
                <ConfirmDialog
                    message={`Delete shipment "${s.recipient || s.tracking_number}"? This cannot be undone.`}
                    onConfirm={handleDelete}
                    onCancel={() => setConfirmOpen(false)}
                />
            )}

            <div className="panel-overlay">
                <div className="panel-backdrop" onClick={onClose} />
                <div className="panel">
                    <div className="panel-header">
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <h2 className="panel-title">{s.items || s.recipient || 'Package'}</h2>
                                <button
                                    className="panel-copy-btn"
                                    style={{ color: 'var(--status-exception-text)', marginLeft: 'auto' }}
                                    onClick={() => setConfirmOpen(true)}
                                    disabled={deleting}
                                    title="Delete Shipment"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                                    {s.tracking_number}
                                </span>
                                <button
                                    className="panel-copy-btn"
                                    onClick={() => navigator.clipboard.writeText(s.tracking_number)}
                                >
                                    Copy
                                </button>
                            </div>
                            <StatusBadge status={s.status} />
                        </div>
                        <button className="panel-close" onClick={onClose}><X size={20} /></button>
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

                    <div className="panel-body">
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
                                <div className="detail-cell-value"><Box size={14} /> {s.recipient || '—'}</div>
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
                                            <div className="timeline-date">{ev.date}</div>
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
