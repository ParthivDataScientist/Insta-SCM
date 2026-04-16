import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const ShipmentSidePanel = ({ isOpen, onClose, title, children, width = '450px' }) => {
    // Escape key to close
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="premium-side-panel">
            <div className="project-officer__drawer-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3>{title}</h3>
                </div>
                <button 
                    type="button" 
                    className="project-officer__drawer-close"
                    onClick={onClose}
                    title="Close panel"
                >
                    <X size={16} />
                </button>
            </div>
            <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
                {children}
            </div>
        </div>
    );
};

export default ShipmentSidePanel;
