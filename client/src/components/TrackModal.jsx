import React, { useState } from 'react';
import { X, Truck, Loader, ArrowUpRight } from 'lucide-react';
import { trackShipment, importExcel } from '../api';

const TrackModal = ({ onClose, onTracked }) => {
    const [trackingNum, setTrackingNum] = useState('');
    const [shipmentName, setShipmentName] = useState('');
    const [exhibitionName, setExhibitionName] = useState('');
    const [showDate, setShowDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [importLoading, setImportLoading] = useState(false);
    const [error, setError] = useState('');

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setImportLoading(true);
        setError('');
        try {
            const result = await importExcel(file);
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
        if (!trackingNum.trim()) {
            setError('Please enter a tracking number');
            return;
        }
        if (!exhibitionName.trim()) {
            setError('Please enter an Exhibition Name');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await trackShipment(
                trackingNum.trim().toUpperCase(),
                shipmentName.trim() || null,
                showDate.trim() || null,
                exhibitionName.trim()
            );
            onTracked();
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="panel-overlay">
            <div className="panel-backdrop" onClick={onClose} />
            <div className="panel" style={{ maxWidth: 440 }}>
                <div className="panel-header">
                    <div>
                        <h2 className="panel-title">Add New Shipment</h2>
                        <p className="panel-subtitle">Enter details to track a specific parcel</p>
                    </div>
                    <button className="panel-close" onClick={onClose}><X size={20} /></button>
                </div>
                <div className="panel-body">
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
