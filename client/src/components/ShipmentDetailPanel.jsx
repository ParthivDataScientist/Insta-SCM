import React, { useEffect, useMemo, useState } from 'react';
import { X, Truck, Calendar, Clock, AlertTriangle, Trash2, Package, MapPin, Phone, Mail } from 'lucide-react';
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

const normalizeHistory = (history = []) => {
    if (!Array.isArray(history)) return [];
    return history
        .map((entry, index) => ({
            description: entry?.description || entry?.event_description || '',
            location: entry?.location || entry?.last_location || '',
            status: entry?.status || entry?.current_status || entry?.description || '',
            date: entry?.date || entry?.timestamp || entry?.event_time || '',
            __idx: index,
        }))
        .filter((entry) => entry.description || entry.location || entry.status || entry.date)
        .sort((a, b) => {
            const ta = Date.parse(a.date || '');
            const tb = Date.parse(b.date || '');
            if (!Number.isNaN(ta) && !Number.isNaN(tb)) return tb - ta;
            if (!Number.isNaN(tb)) return 1;
            if (!Number.isNaN(ta)) return -1;
            return a.__idx - b.__idx;
        })
        .map(({ __idx, ...entry }) => entry);
};

const mergeLiveTracking = (baseShipment, liveShipment) => {
    if (!liveShipment || typeof liveShipment !== 'object') return baseShipment;

    const mergedHistory = normalizeHistory(liveShipment.history);

    return {
        ...baseShipment,
        ...liveShipment,
        history: mergedHistory.length > 0 ? mergedHistory : normalizeHistory(baseShipment.history),
        status: liveShipment.status || baseShipment.status,
        eta: liveShipment.eta || liveShipment.estimated_delivery || baseShipment.eta,
        origin: liveShipment.origin || baseShipment.origin,
        destination: liveShipment.destination || baseShipment.destination,
    };
};

const CARRIER_SUPPORT_CONTACTS = {
    FedEx: {
        email: import.meta.env.VITE_FEDEX_SUPPORT_EMAIL || 'india@fedex.com',
        phone: '18004633339',
    },
    DHL: {
        email: import.meta.env.VITE_DHL_SUPPORT_EMAIL || 'indiaexpress@dhl.com',
        phone: '',
    },
    UPS: {
        email: import.meta.env.VITE_UPS_SUPPORT_EMAIL || 'customer.service@ups.com',
        phone: '',
    },
    BlueDart: {
        email: import.meta.env.VITE_BLUEDART_SUPPORT_EMAIL || 'customerservice@bluedart.com',
        phone: '',
    },
};

const parseDateSafe = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const ts = Date.parse(raw);
    if (Number.isNaN(ts)) return null;
    return new Date(ts);
};

const inferIssueSummary = (shipment, latestEvent) => {
    const status = String(shipment?.status || '').toLowerCase();
    const currentStatus = String(shipment?.current_status || '').toLowerCase();
    const latestDesc = String(latestEvent?.description || '').toLowerCase();
    const issueTokens = ['exception', 'delay', 'hold', 'stuck', 'customs', 'return', 'failed'];
    const combined = `${status} ${currentStatus} ${latestDesc}`;

    if (issueTokens.some((token) => combined.includes(token))) {
        return `The shipment appears to be facing an operational issue (${shipment?.status || 'Status Alert'}).`;
    }

    const latestDate = parseDateSafe(latestEvent?.date);
    if (latestDate) {
        const ageMs = Date.now() - latestDate.getTime();
        if (ageMs > 2 * 24 * 60 * 60 * 1000) {
            return 'The shipment has not shown movement for over 2 days. Please confirm next action and ETA.';
        }
    }

    return 'Please provide an updated delivery timeline and confirm if any action is required from our side.';
};

const buildCarrierEmailDraft = (shipment) => {
    const carrier = shipment?.carrier || 'Carrier';
    const contact = CARRIER_SUPPORT_CONTACTS[carrier] || { email: '', phone: '' };
    const history = Array.isArray(shipment?.history) ? shipment.history : [];
    const latestEvent = history.length > 0 ? history[0] : {};
    const issueSummary = inferIssueSummary(shipment, latestEvent);
    const subject = `[HIGH PRIORITY] Shipment Support Request - ${shipment?.tracking_number || 'N/A'} (${carrier})`;

    const body = [
        'Dear Concerned Team,',
        '',
        'We need urgent assistance with the following shipment:',
        '',
        `Carrier: ${carrier}`,
        `Tracking Number: ${shipment?.tracking_number || 'N/A'}`,
        `Current Dashboard Status: ${shipment?.status || 'N/A'}`,
        `Latest Tracking Update: ${latestEvent?.description || shipment?.current_status || shipment?.status || 'N/A'}`,
        `Latest Location: ${latestEvent?.location || shipment?.last_location || 'N/A'}`,
        `Latest Event Time: ${latestEvent?.date || 'N/A'}`,
        `Origin: ${shipment?.origin || 'N/A'}`,
        `Destination: ${shipment?.destination || 'N/A'}`,
        `Expected Delivery (ETA): ${shipment?.eta || shipment?.estimated_delivery || 'N/A'}`,
        '',
        `Issue Summary: ${issueSummary}`,
        '',
        'Please investigate this on priority and share:',
        '1. Root cause of the current issue/status',
        '2. Updated delivery timeline',
        '3. Any action needed from our side',
        '',
        'Thanks & regards,',
        'Insta-SCM Team',
    ].join('\n');

    return {
        to: contact.email || '',
        phone: contact.phone || '',
        subject,
        body,
    };
};

const ShipmentDetailPanel = ({ shipment, onClose, onDeleted, isPanel = false }) => {
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [resolvedShipment, setResolvedShipment] = useState(shipment);
    const [historyLoading, setHistoryLoading] = useState(false);

    useEffect(() => {
        let active = true;

        const hydrateShipmentDetails = async () => {
            setResolvedShipment(shipment);
            setHistoryLoading(true);

            let nextShipment = shipment;

            try {
                if (shipment?.id) {
                    const dbShipment = await shipmentsService.fetchShipment(shipment.id);
                    if (active && dbShipment) {
                        nextShipment = mergeLiveTracking(nextShipment, dbShipment);
                    }
                }
            } catch (_) {
                // Silent fallback to provided row data.
            }

            try {
                const trackingNumber = (shipment?.tracking_number || '').trim();
                const hasHistory = Array.isArray(nextShipment?.history) && nextShipment.history.length > 0;
                if (trackingNumber && !hasHistory) {
                    const preview = await shipmentsService.previewTrackShipment(trackingNumber, {
                        masterTrackingNumber: shipment?.master_tracking_number || undefined,
                    });
                    if (active && preview) {
                        nextShipment = mergeLiveTracking(nextShipment, preview);
                    }
                }
            } catch (_) {
                // Silent fallback when carrier preview is unavailable.
            }

            if (active) {
                setResolvedShipment(nextShipment);
                setHistoryLoading(false);
            }
        };

        hydrateShipmentDetails();
        return () => {
            active = false;
        };
    }, [shipment]);

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

    const s = useMemo(() => mergeLiveTracking(shipment, resolvedShipment), [shipment, resolvedShipment]);
    const emailDraft = useMemo(() => buildCarrierEmailDraft(s), [s]);
    const originCity = (s.origin || 'N/A').split(',')[0];
    const originState = (s.origin || '').split(',')[1] || '';
    const destCity = (s.destination || 'N/A').split(',')[0];
    const destState = (s.destination || '').split(',')[1] || '';

    const handleEmailCarrier = () => {
        const mailtoUrl = `mailto:${emailDraft.to}?subject=${encodeURIComponent(emailDraft.subject)}&body=${encodeURIComponent(emailDraft.body)}`;
        window.location.href = mailtoUrl;
    };

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
                {historyLoading ? (
                    <div className="empty-state">Loading latest tracking history...</div>
                ) : Array.isArray(s.history) && s.history.length > 0 ? (
                    <div className="history-tree">
                        {s.history.map((ev, i) => (
                            <div key={`${ev.date || 'na'}-${ev.status || 'st'}-${i}`} className={`history-tree__node ${i === 0 ? 'is-current' : ''}`}>
                                <div className="history-tree__branch">
                                    <div className="history-tree__dot" />
                                    {i !== s.history.length - 1 && <div className="history-tree__line" />}
                                </div>
                                <div className="history-tree__card">
                                    <div className="timeline-time">{formatHistoryDate(ev.date) || 'Timestamp unavailable'}</div>
                                    <div className="timeline-status">{ev.status || ev.description || 'Status update'}</div>
                                    {ev.location ? <div className="timeline-location"><MapPin size={10} /> {ev.location}</div> : null}
                                    {ev.description ? <div className="timeline-desc">{ev.description}</div> : null}
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
                    {emailDraft.phone ? (
                        <a href={`tel:${emailDraft.phone}`} className="support-btn">
                            <Phone size={14} /> Call {s.carrier || 'Carrier'}
                        </a>
                    ) : null}
                    <button className="support-btn tertiary" onClick={handleEmailCarrier}>
                        <Mail size={14} /> Email {s.carrier || 'Carrier'}
                    </button>
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
