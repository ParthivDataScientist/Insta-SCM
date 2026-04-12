import React from 'react';
import { Calendar, X } from 'lucide-react';
import { useGlobalDateRange } from '../contexts/GlobalDateRangeContext';

export default function GlobalDateRangePicker({ compact = false, label = 'Master Date', className = '' }) {
  const { dateRange, setDateRange, clearDateRange } = useGlobalDateRange();
  const hasActiveRange = Boolean(dateRange.start || dateRange.end);
  const rootClassName = `saas-filter-chip${compact ? ' is-compact' : ''}${className ? ` ${className}` : ''}`;

  return (
    <div className={rootClassName}>
      <Calendar size={14} color="var(--tx3)" />
      <span className="saas-eyebrow">{label}</span>
      <label className="saas-filter-chip__date-field">
        <span className="saas-filter-chip__date-label">From</span>
        <input
          type="date"
          value={dateRange.start}
          onChange={(event) => setDateRange((prev) => ({ ...prev, start: event.target.value }))}
          style={{ width: compact ? '96px' : '108px', fontSize: '12px' }}
        />
      </label>
      <span className="saas-filter-chip__date-separator">to</span>
      <label className="saas-filter-chip__date-field">
        <span className="saas-filter-chip__date-label">To</span>
        <input
          type="date"
          value={dateRange.end}
          onChange={(event) => setDateRange((prev) => ({ ...prev, end: event.target.value }))}
          style={{ width: compact ? '96px' : '108px', fontSize: '12px' }}
        />
      </label>
      {hasActiveRange && (
        <button
          type="button"
          className="premium-icon-button"
          onClick={clearDateRange}
          title="Clear master date range"
          style={{ width: '32px', minWidth: '32px', height: '32px', color: 'var(--tx3)' }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
