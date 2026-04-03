import React from 'react';
import { Calendar, X } from 'lucide-react';
import { useGlobalDateRange } from '../contexts/GlobalDateRangeContext';

export default function GlobalDateRangePicker({ compact = false }) {
  const { dateRange, setDateRange, clearDateRange } = useGlobalDateRange();
  const hasActiveRange = Boolean(dateRange.start || dateRange.end);

  return (
    <div
      className="animate-card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: compact ? '6px' : '8px',
        padding: compact ? '6px 10px' : '8px 12px',
        background: 'var(--bg-in)',
        border: '1px solid var(--bd)',
        borderRadius: 'var(--r-md)',
      }}
    >
      <Calendar size={14} color="var(--tx3)" />
      <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--tx3)' }}>
        Master Date
      </span>
      <input
        type="date"
        value={dateRange.start}
        onChange={(event) => setDateRange((prev) => ({ ...prev, start: event.target.value }))}
        style={{
          background: 'transparent',
          border: 'none',
          font: 'inherit',
          fontSize: '11px',
          color: 'var(--tx)',
          outline: 'none',
          width: '110px',
        }}
      />
      <span style={{ color: 'var(--tx3)', fontSize: '11px' }}>to</span>
      <input
        type="date"
        value={dateRange.end}
        onChange={(event) => setDateRange((prev) => ({ ...prev, end: event.target.value }))}
        style={{
          background: 'transparent',
          border: 'none',
          font: 'inherit',
          fontSize: '11px',
          color: 'var(--tx)',
          outline: 'none',
          width: '110px',
        }}
      />
      {hasActiveRange && (
        <button
          type="button"
          className="icon-btn"
          onClick={clearDateRange}
          title="Clear master date range"
          style={{ width: '24px', height: '24px', color: 'var(--tx3)' }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
