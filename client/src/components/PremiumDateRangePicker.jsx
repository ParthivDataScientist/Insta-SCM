import React, { useState, useRef, useEffect } from 'react';
import { DateRange } from 'react-date-range';
import { Calendar, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useGlobalDateRange } from '../contexts/GlobalDateRangeContext';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';

export default function PremiumDateRangePicker({ className = '' }) {
    const { dateRange, setDateRange, clearDateRange } = useGlobalDateRange();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (ranges) => {
        const { startDate, endDate } = ranges.selection;
        setDateRange({
            start: startDate ? format(startDate, 'yyyy-MM-dd') : '',
            end: endDate ? format(endDate, 'yyyy-MM-dd') : '',
        });
    };

    const hasActiveRange = Boolean(dateRange.start || dateRange.end);

    const displayValue = () => {
        if (!hasActiveRange) return 'Select dates';
        const start = dateRange.start ? format(parseISO(dateRange.start), 'MMM dd, yyyy') : '';
        const end = dateRange.end ? format(parseISO(dateRange.end), 'MMM dd, yyyy') : '';
        if (start && end) return `${start} - ${end}`;
        if (start) return `${start} - ...`;
        if (end) return `... - ${end}`;
        return 'Select dates';
    };

    const selectionRange = React.useMemo(() => ({
        startDate: dateRange.start ? parseISO(dateRange.start) : new Date(),
        endDate: dateRange.end ? parseISO(dateRange.end) : new Date(),
        key: 'selection',
    }), [dateRange.start, dateRange.end]);

    const ranges = React.useMemo(() => [selectionRange], [selectionRange]);

    return (
        <div className={`design-premium-travel-picker ${className}`} ref={ref}>
            <div 
                className="design-premium-travel-picker__control" 
                onClick={() => setOpen(!open)}
            >
                <Calendar size={14} className="design-premium-travel-picker__icon" />
                <span className="design-premium-travel-picker__value">{displayValue()}</span>
                {hasActiveRange && (
                    <button 
                        type="button" 
                        onClick={(e) => { e.stopPropagation(); clearDateRange(); }}
                        className="design-premium-travel-picker__clear"
                        title="Clear dates"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>

            {open && (
                <div className="design-premium-travel-picker__dropdown">
                    <DateRange
                        ranges={ranges}
                        onChange={handleSelect}
                        rangeColors={['#2563eb']}
                        showSelectionPreview={true}
                        moveRangeOnFirstSelection={false}
                        months={1}
                        direction="horizontal"
                    />
                </div>
            )}
        </div>
    );
}
