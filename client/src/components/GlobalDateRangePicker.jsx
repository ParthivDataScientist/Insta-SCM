import React from 'react';
import { Calendar, X } from 'lucide-react';
import { useGlobalDateRange } from '../contexts/GlobalDateRangeContext';

export default function GlobalDateRangePicker({ compact = false }) {
  const { dateRange, setDateRange, clearDateRange } = useGlobalDateRange();
  const hasActiveRange = Boolean(dateRange.start || dateRange.end);

  return (
    <div className="premium-range-picker">
      <Calendar size={14} color="var(--tx3)" />
      {!compact ? <span className="premium-range-picker__label">Date</span> : null}
      <label className="premium-inline-input" style={{ minHeight: compact ? '36px' : '40px' }}>
        <input
          type="date"
          value={dateRange.start}
          onChange={(event) => setDateRange((prev) => ({ ...prev, start: event.target.value }))}
        />
      </label>
      <span style={{ color: 'var(--tx3)', fontSize: '12px' }}>to</span>
      <label className="premium-inline-input" style={{ minHeight: compact ? '36px' : '40px' }}>
        <input
          type="date"
          value={dateRange.end}
          onChange={(event) => setDateRange((prev) => ({ ...prev, end: event.target.value }))}
        />
      </label>
      {hasActiveRange && (
        <button
          type="button"
          className="premium-icon-button"
          onClick={clearDateRange}
          title="Clear master date range"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
