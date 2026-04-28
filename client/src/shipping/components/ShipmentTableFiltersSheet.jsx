import React from 'react';
import { X } from 'lucide-react';

const renderChipGroup = (label, values, selected, onToggle) => (
    <div className="shipping-mobile-sheet__group">
        <div className="shipping-mobile-sheet__label">{label}</div>
        <div className="shipping-mobile-sheet__chips">
            {values.map((value) => (
                <button
                    key={value}
                    type="button"
                    className={`shipping-mobile-chip ${selected.includes(value) ? 'is-active' : ''}`}
                    onClick={() => onToggle(value)}
                >
                    {value}
                </button>
            ))}
        </div>
    </div>
);

const ShipmentTableFiltersSheet = ({
    isOpen,
    onClose,
    idSearch,
    setIdSearch,
    allStatuses,
    allCarriers,
    allExhibitions,
    statusFilter,
    carrierFilter,
    exhibitionFilter,
    onToggleStatus,
    onToggleCarrier,
    onToggleExhibition,
    onClearAll,
}) => {
    if (!isOpen) return null;

    return (
        <>
            <button
                type="button"
                className="shipping-mobile-sheet-backdrop"
                aria-label="Close filters"
                onClick={onClose}
            />
            <section className="shipping-mobile-sheet" role="dialog" aria-modal="true" aria-label="Shipment filters">
                <div className="shipping-mobile-sheet__header">
                    <h3>Filters</h3>
                    <button type="button" className="shipping-mobile-sheet__close" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>
                <div className="shipping-mobile-sheet__body">
                    <label className="shipping-mobile-sheet__field">
                        <span className="shipping-mobile-sheet__label">Search tracking</span>
                        <input
                            type="text"
                            value={idSearch}
                            onChange={(event) => setIdSearch(event.target.value)}
                            placeholder="Tracking, items, recipient..."
                        />
                    </label>

                    {renderChipGroup('Status', allStatuses, statusFilter, onToggleStatus)}
                    {renderChipGroup('Carrier', allCarriers, carrierFilter, onToggleCarrier)}
                    {renderChipGroup('Exhibition', allExhibitions, exhibitionFilter, onToggleExhibition)}
                </div>
                <div className="shipping-mobile-sheet__footer">
                    <button type="button" className="shipping-mobile-sheet__ghost" onClick={onClearAll}>
                        Clear all
                    </button>
                    <button type="button" className="shipping-mobile-sheet__primary" onClick={onClose}>
                        Apply
                    </button>
                </div>
            </section>
        </>
    );
};

export default ShipmentTableFiltersSheet;
