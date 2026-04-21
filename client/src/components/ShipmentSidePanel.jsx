import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

const ShipmentSidePanel = ({ isOpen, onClose, title, children, width = '450px' }) => {
    const [useBottomSheet, setUseBottomSheet] = useState(() => (
        typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : false
    ));

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const media = window.matchMedia('(max-width: 1023px)');
        const sync = () => setUseBottomSheet(media.matches);
        sync();
        media.addEventListener('change', sync);
        return () => media.removeEventListener('change', sync);
    }, []);

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
        <>
            {useBottomSheet ? (
                <button
                    type="button"
                    className="shipping-sheet-overlay"
                    aria-label="Close panel"
                    onClick={onClose}
                />
            ) : null}
            <div className={`premium-side-panel ${useBottomSheet ? 'premium-side-panel--sheet' : ''}`} style={useBottomSheet ? undefined : { width }}>
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
        </>
    );
};

export default ShipmentSidePanel;
