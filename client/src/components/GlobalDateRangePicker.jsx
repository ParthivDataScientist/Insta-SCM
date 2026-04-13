import React from 'react';
import { Calendar, X } from 'lucide-react';
import { useGlobalDateRange } from '../contexts/GlobalDateRangeContext';

export default function GlobalDateRangePicker({ compact = false, label = 'Master Date', className = '', ...rootProps }) {
  const { dateRange, setDateRange, clearDateRange } = useGlobalDateRange();
  const hasActiveRange = Boolean(dateRange.start || dateRange.end);
  const rootClassName = `saas-filter-chip global-date-range${compact ? ' is-compact global-date-range--compact' : ''}${className ? ` ${className}` : ''}`;
  const inputWidth = compact
    ? 'var(--global-date-range-input-width-compact, 96px)'
    : 'var(--global-date-range-input-width, 108px)';
  const inputFontSize = 'var(--global-date-range-input-font-size, 12px)';
  const clearButtonSize = 'var(--global-date-range-clear-size, 32px)';

  return (
    <div className={rootClassName} {...rootProps}>
      <Calendar size={14} color="var(--tx3)" aria-hidden />
      {label ? <span className="saas-eyebrow">{label}</span> : null}
      <label className="saas-filter-chip__date-field">
        <span className="saas-filter-chip__date-label">From</span>
        <input
          type="date"
          value={dateRange.start}
          onChange={(event) => setDateRange((prev) => ({ ...prev, start: event.target.value }))}
          style={{ width: inputWidth, fontSize: inputFontSize }}
        />
      </label>
      <span className="saas-filter-chip__date-separator">to</span>
      <label className="saas-filter-chip__date-field">
        <span className="saas-filter-chip__date-label">To</span>
        <input
          type="date"
          value={dateRange.end}
          onChange={(event) => setDateRange((prev) => ({ ...prev, end: event.target.value }))}
          style={{ width: inputWidth, fontSize: inputFontSize }}
        />
      </label>
      {hasActiveRange && (
        <button
          type="button"
          className="premium-icon-button"
          onClick={clearDateRange}
          title="Clear master date range"
          style={{ width: clearButtonSize, minWidth: clearButtonSize, height: clearButtonSize, color: 'var(--tx3)' }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
