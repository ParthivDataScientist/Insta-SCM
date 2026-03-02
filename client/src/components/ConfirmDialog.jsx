import React from 'react';
import { X } from 'lucide-react';

/**
 * In-app confirmation dialog — replaces window.confirm().
 * Props:
 *   message   - string to display
 *   onConfirm - called when user confirms
 *   onCancel  - called when user cancels
 */
const ConfirmDialog = ({ message, onConfirm, onCancel }) => (
    <div className="panel-overlay" style={{ zIndex: 9999 }}>
        <div className="panel-backdrop" onClick={onCancel} />
        <div className="panel" style={{ maxWidth: 380 }}>
            <div className="panel-header">
                <h2 className="panel-title">Confirm Action</h2>
                <button className="panel-close" onClick={onCancel}><X size={20} /></button>
            </div>
            <div className="panel-body">
                <p style={{ marginBottom: 24, color: 'var(--color-text-secondary)', fontSize: 14 }}>
                    {message}
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    <button className="btn btn-outline" onClick={onCancel}>Cancel</button>
                    <button
                        className="btn btn-primary"
                        onClick={onConfirm}
                        style={{ background: 'var(--status-exception-text)', borderColor: 'var(--status-exception-text)' }}
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    </div>
);

export default ConfirmDialog;
