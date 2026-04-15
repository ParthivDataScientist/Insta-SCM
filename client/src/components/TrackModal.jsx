import React, { useEffect, useMemo, useState } from 'react';
import { X, Truck, Loader, ArrowUpRight } from 'lucide-react';
import shipmentsService from '../api/shipments';
import projectsService from '../api/projects';

const TrackModal = ({ onClose, onTracked }) => {
    const [trackingNum, setTrackingNum] = useState('');
    const [shipmentName, setShipmentName] = useState('');
    const [exhibitionName, setExhibitionName] = useState('');
    const [showDate, setShowDate] = useState('');
    const [cs, setCs] = useState('');
    const [noOfBox, setNoOfBox] = useState('');
    const [loading, setLoading] = useState(false);
    const [importLoading, setImportLoading] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        // Project fetching removed since tracking is independent
    }, []);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setImportLoading(true);
        setError('');
        try {
            const result = await shipmentsService.importExcel(file);
            onTracked();
            onClose();

            // Show detailed alert with success and failure counts
            if (result?.status === 'completed') {
                let msg = `Import complete: ${result.success} succeeded, ${result.failed} failed.`;
                if (result.failed > 0 && result.errors && result.errors.length > 0) {
                    msg += `\n\nErrors:\n` + result.errors.slice(0, 5).join('\n');
                    if (result.errors.length > 5) {
                        msg += `\n...and ${result.errors.length - 5} more.`;
                    }
                }
                alert(msg);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setImportLoading(false);
            // reset file input
            e.target.value = null;
        }
    };

    const handleTrack = async () => {
        const trackingNumber = trackingNum.trim().toUpperCase();
        const shipmentLabel = shipmentName.trim();
        const exhibition = exhibitionName.trim();
        const eventDate = showDate.trim();
        const incoterm = cs.trim();
        const boxCount = noOfBox.trim();

        if (!trackingNumber) {
            setError('Please enter a tracking number');
            return;
        }
        if (!exhibition) {
            setError('Please enter an Exhibition Name');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await shipmentsService.trackShipment(trackingNumber, {
                recipient: shipmentLabel || null,
                shipment_name: shipmentLabel || null,
                show_date: eventDate || null,
                exhibition_name: exhibition,
                cs: incoterm || null,
                no_of_box: boxCount || null,
                project_id: null,
            });
            onTracked();
            onClose();
        } catch (err) {
            setError(err.response?.data?.detail || err.message || 'Failed to track shipment');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="panel-overlay saas-theme" style={{ zIndex: 1000, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            <div className="panel-backdrop" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
            <div className="panel saas-modal" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '450px', transform: 'none', borderRadius: '16px 0 0 16px', margin: 0, borderRight: 'none', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div className="saas-modal__header">
                    <div>
                        <h2 className="panel-title" style={{ margin: '0 0 4px 0', fontSize: '20px', color: 'var(--text-primary)', lineHeight: 1.2, fontFamily: 'var(--font-display)' }}>Add New Shipment</h2>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Enter details to track a specific parcel</span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <button className="premium-icon-button premium-icon-button--danger" onClick={onClose} title="Close Panel">
                            <X size={24} />
                        </button>
                    </div>
                </div>
                <div className="saas-modal__body no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                    <div className="form-group">
                        <label className="form-label">Tracking Number</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="e.g. 888123456789"
                            value={trackingNum}
                            onChange={e => setTrackingNum(e.target.value)}
                        />
                    </div>
                    <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className="form-group">
                            <label className="form-label">Shipment Name</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g. Laptop Stand"
                                value={shipmentName}
                                onChange={e => setShipmentName(e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Exhibition Name</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g. Tech Expo 2026"
                                value={exhibitionName}
                                onChange={e => setExhibitionName(e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">C/S (e.g. C-DDP)</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g. C-DDP"
                                value={cs}
                                onChange={e => setCs(e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">No of Box</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g. 5"
                                value={noOfBox}
                                onChange={e => setNoOfBox(e.target.value)}
                            />
                        </div>
                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                            <label className="form-label">Event Date / Extra Info</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g. March 15th"
                                value={showDate}
                                onChange={e => setShowDate(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleTrack()}
                            />
                        </div>
                    </div>
                    {error && (
                        <div className="status-badge" style={{
                            color: 'var(--red)',
                            background: 'var(--red-ghost)',
                            padding: '10px 14px',
                            borderRadius: 'var(--r-md)',
                            fontSize: 13,
                        }}>
                            {error}
                        </div>
                    )}
                    <button
                        className="btn-primary"
                        onClick={handleTrack}
                        disabled={loading || importLoading}
                        style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}
                    >
                        {loading ? <Loader size={16} className="animate-spin" /> : <><Truck size={16} /> Track Shipment</>}
                    </button>

                    <div style={{ margin: '16px 0', borderTop: '1px solid var(--color-border-light)', paddingTop: 16 }}>
                        <p className="form-label" style={{ marginBottom: 12 }}>Or Batch Import from Excel</p>
                        <input
                            type="file"
                            id="excel-upload"
                            style={{ display: 'none' }}
                            accept=".xlsx,.xls"
                            onChange={handleFileUpload}
                        />
                        <button
                            className="btn btn-outline"
                            disabled={importLoading || loading}
                            onClick={() => document.getElementById('excel-upload').click()}
                            style={{ width: '100%', justifyContent: 'center' }}
                        >
                            {importLoading
                                ? <Loader size={16} className="animate-spin" />
                                : <><ArrowUpRight size={16} /> Import Excel File</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TrackModal;
