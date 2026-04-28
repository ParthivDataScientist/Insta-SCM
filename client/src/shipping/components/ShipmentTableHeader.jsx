import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Filter, Search } from 'lucide-react';
import { SHIPMENT_TABLE_COLUMNS } from '../constants/tableColumns';

function useOnClickOutside(ref, handler) {
    useEffect(() => {
        const listener = (event) => {
            if (!ref.current || ref.current.contains(event.target)) return;
            handler(event);
        };

        document.addEventListener('mousedown', listener);
        document.addEventListener('touchstart', listener);
        return () => {
            document.removeEventListener('mousedown', listener);
            document.removeEventListener('touchstart', listener);
        };
    }, [handler, ref]);
}

const FilterPopover = ({ title, className = '', isActive, onClear, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);
    useOnClickOutside(ref, () => setIsOpen(false));

    return (
        <th className={`filter-th design-table__th design-table__th--left ${className}`} ref={ref}>
            <button type="button" className="th-content shipment-table__filter-trigger" onClick={() => setIsOpen((previous) => !previous)}>
                <span>{title}</span>
                <span className={`filter-icon-wrapper ${isActive ? 'active' : ''}`}>
                    <Filter size={13} />
                    <ChevronDown size={12} className={`chevron ${isOpen ? 'open' : ''}`} />
                </span>
            </button>
            {isOpen ? (
                <div className="filter-popover" onClick={(event) => event.stopPropagation()}>
                    <div className="fp-header">
                        <span className="fp-title">Filter {title}</span>
                        {isActive ? (
                            <button
                                type="button"
                                className="fp-clear"
                                onClick={() => {
                                    onClear();
                                    setIsOpen(false);
                                }}
                            >
                                Clear
                            </button>
                        ) : null}
                    </div>
                    <div className="fp-body">{children}</div>
                </div>
            ) : null}
        </th>
    );
};

const ShipmentTableHeader = ({
    idSearch,
    setIdSearch,
    exhibitionFilter,
    setExhibitionFilter,
    statusFilter,
    setStatusFilter,
    carrierFilter,
    setCarrierFilter,
    allExhibitions,
    allStatuses,
    allCarriers,
    allVisibleSelected,
    handleSelectAll,
}) => {
    const [idColumn, statusColumn, currentColumn, etaColumn, showDateColumn, carrierColumn, routeColumn, actionsColumn] = SHIPMENT_TABLE_COLUMNS;

    const toggleArrayItem = (array, setArray, item) => {
        if (array.includes(item)) {
            setArray(array.filter((entry) => entry !== item));
            return;
        }
        setArray([...array, item]);
    };

    return (
        <thead className="design-table__thead">
            <tr>
                <th className="design-table__th design-table__th--left shipping-col-check">
                    <button type="button" className={`custom-checkbox ${allVisibleSelected ? 'checked' : ''}`} onClick={handleSelectAll}>
                        {allVisibleSelected ? <Check size={10} /> : null}
                    </button>
                </th>

                <FilterPopover
                    title={idColumn.label}
                    className={idColumn.className}
                    isActive={Boolean(idSearch)}
                    onClear={() => setIdSearch('')}
                >
                    <label className="fp-search">
                        <Search size={13} />
                        <input
                            type="text"
                            value={idSearch}
                            onChange={(event) => setIdSearch(event.target.value)}
                            placeholder="Tracking, items, recipient..."
                        />
                    </label>
                </FilterPopover>

                <FilterPopover
                    title={statusColumn.label}
                    className={statusColumn.className}
                    isActive={statusFilter.length > 0}
                    onClear={() => setStatusFilter([])}
                >
                    {allStatuses.map((status) => (
                        <label key={status} className="fp-option">
                            <input
                                type="checkbox"
                                checked={statusFilter.includes(status)}
                                onChange={() => toggleArrayItem(statusFilter, setStatusFilter, status)}
                            />
                            <span>{status}</span>
                        </label>
                    ))}
                </FilterPopover>

                <th className={`design-table__th design-table__th--left ${currentColumn.className}`}>{currentColumn.label}</th>
                <th className={`design-table__th design-table__th--left ${etaColumn.className}`}>{etaColumn.label}</th>
                <th className={`design-table__th design-table__th--left ${showDateColumn.className}`}>{showDateColumn.label}</th>

                <FilterPopover
                    title={carrierColumn.label}
                    className={carrierColumn.className}
                    isActive={carrierFilter.length > 0}
                    onClear={() => setCarrierFilter([])}
                >
                    {allCarriers.map((carrier) => (
                        <label key={carrier} className="fp-option">
                            <input
                                type="checkbox"
                                checked={carrierFilter.includes(carrier)}
                                onChange={() => toggleArrayItem(carrierFilter, setCarrierFilter, carrier)}
                            />
                            <span>{carrier}</span>
                        </label>
                    ))}
                </FilterPopover>

                <FilterPopover
                    title={routeColumn.label}
                    className={routeColumn.className}
                    isActive={exhibitionFilter.length > 0}
                    onClear={() => setExhibitionFilter([])}
                >
                    {allExhibitions.map((exhibition) => (
                        <label key={exhibition} className="fp-option">
                            <input
                                type="checkbox"
                                checked={exhibitionFilter.includes(exhibition)}
                                onChange={() => toggleArrayItem(exhibitionFilter, setExhibitionFilter, exhibition)}
                            />
                            <span>{exhibition}</span>
                        </label>
                    ))}
                </FilterPopover>

                <th className={`design-table__th design-table__th--left ${actionsColumn.className}`}>{actionsColumn.label}</th>
            </tr>
        </thead>
    );
};

export default ShipmentTableHeader;
