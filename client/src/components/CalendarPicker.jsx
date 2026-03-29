import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

/**
 * Custom Floating Calendar Picker
 * Premium UI with Portal support and Year Selection.
 */
const CalendarPicker = ({ initialDate, anchorRect, onSelect, onClose }) => {
    const now = new Date();
    const [viewDate, setViewDate] = useState(initialDate ? new Date(initialDate) : now);
    
    // Portal cleanup
    useEffect(() => {
        const handleClickOutside = (e) => {
             if (!e.target.closest('.calendar-picker-popover')){
                onClose();
             }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Dynamic Positioning with Collision Detection
    const CALENDAR_WIDTH = 260;
    const CALENDAR_HEIGHT = 340;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let top = anchorRect.bottom + 5;
    let left = anchorRect.left;

    // Check right overflow
    if (left + CALENDAR_WIDTH > windowWidth) {
        left = anchorRect.right - CALENDAR_WIDTH;
    }
    // Check left overflow (just in case)
    if (left < 10) left = 10;

    // Check bottom overflow
    if (top + CALENDAR_HEIGHT > windowHeight) {
        top = anchorRect.top - CALENDAR_HEIGHT - 5;
    }

    const popoverStyle = {
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${CALENDAR_WIDTH}px`,
        zIndex: 100000,
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)'
    };

    const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currMonth = viewDate.getMonth();
    const currYear = viewDate.getFullYear();
    const daysInMonth = getDaysInMonth(currMonth, currYear);
    const firstDay = getFirstDayOfMonth(currMonth, currYear);

    const handlePrev = (e) => {
        e.stopPropagation();
        setViewDate(new Date(currYear, currMonth - 1, 1));
    };

    const handleNext = (e) => {
        e.stopPropagation();
        setViewDate(new Date(currYear, currMonth + 1, 1));
    };

    const handleYearChange = (e) => {
        setViewDate(new Date(parseInt(e.target.value), currMonth, 1));
    };

    const handleDateClick = (day) => {
         const selected = new Date(currYear, currMonth, day);
         const offset = selected.getTimezoneOffset();
         const adjusted = new Date(selected.getTime() - (offset * 60 * 1000));
         onSelect(adjusted.toISOString().split('T')[0]);
    };

    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(<div key={`pad-${i}`} className="cp-day empty"></div>);
    for (let d = 1; d <= daysInMonth; d++) {
        const isToday = now.getDate() === d && now.getMonth() === currMonth && now.getFullYear() === currYear;
        const isSel = initialDate && new Date(initialDate).getDate() === d && new Date(initialDate).getMonth() === currMonth && new Date(initialDate).getFullYear() === currYear;
        
        days.push(
            <div 
                key={d} 
                className={`cp-day ${isToday ? 'today' : ''} ${isSel ? 'selected' : ''}`}
                onClick={(e) => { e.stopPropagation(); handleDateClick(d); }}
            >
                {d}
            </div>
        );
    }

    // Years for select
    const years = [];
    for (let y = now.getFullYear() - 5; y <= now.getFullYear() + 10; y++) years.push(y);

    return ReactDOM.createPortal(
        <div className="calendar-picker-popover active" style={popoverStyle} onClick={e => e.stopPropagation()}>
            <div className="cp-header">
                <button className="cp-btn" onClick={handlePrev}><ChevronLeft size={16} /></button>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div className="cp-title">{monthNames[currMonth]}</div>
                    <select value={currYear} onChange={handleYearChange} className="cp-year-select">
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <button className="cp-btn" onClick={handleNext}><ChevronRight size={16} /></button>
            </div>
            <div className="cp-weekdays">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d} className="cp-wd">{d}</div>)}
            </div>
            <div className="cp-grid">
                {days}
            </div>
            <div className="cp-footer">
                <button className="cp-action-btn today" onClick={(e) => { e.stopPropagation(); onSelect(new Date().toISOString().split('T')[0]); }}>Today</button>
                <button className="cp-action-btn clear" onClick={(e) => { e.stopPropagation(); onSelect(null); }}>Clear</button>
            </div>
        </div>,
        document.body
    );
};

export default CalendarPicker;
