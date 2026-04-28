import React, { useEffect, useMemo, useState } from 'react';
import { X, Truck, Loader, ArrowUpRight } from 'lucide-react';
import shipmentsService from '../api/shipments';
import projectsService from '../api/projects';

const TrackModal = ({ onClose, onTracked, isPanel = false }) => {
    const [trackingNum, setTrackingNum] = useState('');
    const [shipmentName, setShipmentName] = useState('');
    const [destination, setDestination] = useState('');
    const [exhibitionName, setExhibitionName] = useState('');
    const [showDate, setShowDate] = useState('');
    const [cs, setCs] = useState('');
    const [noOfBox, setNoOfBox] = useState('');
    const [loading, setLoading] = useState(false);
    const [importLoading, setImportLoading] = useState(false);
    const [error, setError] = useState('');

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setImportLoading(true);
        setError('');
        try {
            const result = await shipmentsService.importExcel(file);
            onTracked();
            onClose();
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
            e.target.value = null;
        }
    };

    const handleTrack = async () => {
        const trackingNumber = trackingNum.trim().toUpperCase();
        const shipmentLabel = shipmentName.trim();
        const destinationValue = destination.trim();
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
                destination: destinationValue || null,
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

    const content = (
        <div className="shipment-detail-content no-scrollbar">
            <div className="form-group">
                <label className="dmc-label">Tracking Number</label>
                <input
                    type="text"
                    className="form-input"
                    style={{ background: '#f8fafc', border: '1px solid #e2e8f0', width: '100%', padding: '12px 16px', borderRadius: '10px' }}
                    placeholder="e.g. 888123456789"
                    value={trackingNum}
                    onChange={e => setTrackingNum(e.target.value)}
                />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                    <label className="dmc-label">Shipment Name</label>
                    <input
                        type="text"
                        className="form-input"
                        style={{ background: '#f8fafc', border: '1px solid #e2e8f0', width: '100%', padding: '12px 16px', borderRadius: '10px' }}
                        placeholder="e.g. Laptop Stand"
                        value={shipmentName}
                        onChange={e => setShipmentName(e.target.value)}
                    />
                </div>
                <div className="form-group">
                    <label className="dmc-label">Exhibition</label>
                    <input
                        type="text"
                        className="form-input"
                        style={{ background: '#f8fafc', border: '1px solid #e2e8f0', width: '100%', padding: '12px 16px', borderRadius: '10px' }}
                        placeholder="e.g. Tech Expo"
                        value={exhibitionName}
                        onChange={e => setExhibitionName(e.target.value)}
                    />
                </div>
                <div className="form-group">
                    <label className="dmc-label">Destination (Fallback)</label>
                    <input
                        type="text"
                        className="form-input"
                        style={{ background: '#f8fafc', border: '1px solid #e2e8f0', width: '100%', padding: '12px 16px', borderRadius: '10px' }}
                        placeholder="e.g. Irving, TX, US"
                        value={destination}
                        onChange={e => setDestination(e.target.value)}
                    />
                </div>
                <div className="form-group">
                    <label className="dmc-label">C/S (e.g. C-DDP)</label>
                    <input
                        type="text"
                        className="form-input"
                        style={{ background: '#f8fafc', border: '1px solid #e2e8f0', width: '100%', padding: '12px 16px', borderRadius: '10px' }}
                        placeholder="e.g. C-DDP"
                        value={cs}
                        onChange={e => setCs(e.target.value)}
                    />
                </div>
                <div className="form-group">
                    <label className="dmc-label">No of Box</label>
                    <input
                        type="text"
                        className="form-input"
                        style={{ background: '#f8fafc', border: '1px solid #e2e8f0', width: '100%', padding: '12px 16px', borderRadius: '10px' }}
                        placeholder="e.g. 5"
                        value={noOfBox}
                        onChange={e => setNoOfBox(e.target.value)}
                    />
                </div>
            </div>

            <div className="form-group">
                <label className="dmc-label">Event Date / Info</label>
                <input
                    type="text"
                    className="form-input"
                    style={{ background: '#f8fafc', border: '1px solid #e2e8f0', width: '100%', padding: '12px 16px', borderRadius: '10px' }}
                    placeholder="e.g. March 15th"
                    value={showDate}
                    onChange={e => setShowDate(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleTrack()}
                />
            </div>

            {error && (
                <div style={{ color: '#ef4444', fontSize: '12px', fontWeight: 600, background: 'rgba(239, 68, 68, 0.05)', padding: '10px', borderRadius: '8px' }}>
                    {error}
                </div>
            )}

            <button
                className="design-premium-btn design-premium-btn--primary"
                onClick={handleTrack}
                disabled={loading || importLoading}
                style={{ width: '100%', marginTop: '8px' }}
            >
                {loading ? <Loader size={16} className="animate-spin" /> : <><Truck size={16} /> Track Shipment</>}
            </button>

            <div style={{ marginTop: '24px', borderTop: '1px solid #f1f5f9', paddingTop: '24px' }}>
                <p className="dmc-label" style={{ marginBottom: '12px' }}>Bulk Import from Excel</p>
                <input type="file" id="panel-excel-upload" style={{ display: 'none' }} accept=".xlsx,.xls" onChange={handleFileUpload} />
                <button
                    className="design-premium-btn"
                    style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569' }}
                    disabled={importLoading || loading}
                    onClick={() => document.getElementById('panel-excel-upload').click()}
                >
                    {importLoading ? <Loader size={16} className="animate-spin" /> : <><ArrowUpRight size={16} /> Upload Excel</>}
                </button>
            </div>
        </div>
    );

    if (isPanel) return content;

    return (
        <div className="legacy-modal-overlay">
            <div className="legacy-modal-backdrop" onClick={onClose} />
            <div className="legacy-modal-content">
                <div className="modal-header">
                    <h2>Track New Shipment</h2>
                    <button onClick={onClose}><X size={20} /></button>
                </div>
                {content}
            </div>
        </div>
    );
};

export default TrackModal;
