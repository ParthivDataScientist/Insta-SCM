import React from 'react';

/**
 * TimelineHeader Component
 * Renders the horizontal time axis (Days/Weeks/Months labels)
 */
export default function TimelineHeader({ units, cellWidth, viewMode }) {
  // Group units by month/year for the top row
  const monthGroups = units.reduce((acc, date) => {
    const key = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!acc[key]) acc[key] = 0;
    acc[key]++;
    return acc;
  }, {});

  return (
    <div className="gantt-header-sticky" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--bd-l)' }}>
        <div style={{ width: '240px', flexShrink: 0, borderRight: '1px solid var(--bd)' }} />
        {Object.entries(monthGroups).map(([name, count]) => (
          <div key={name} style={{ 
            width: count * cellWidth, flexShrink: 0, 
            padding: '8px 12px', fontSize: '11px', fontWeight: 600, 
            color: 'var(--tx3)', borderRight: '1px solid var(--bd-l)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            letterSpacing: '0.02em'
          }}>
            {name}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex' }}>
        <div style={{ 
          width: '240px', flexShrink: 0, borderRight: '1px solid var(--bd)', 
          padding: '10px 16px', fontSize: '11px', fontWeight: 700, 
          color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em' 
        }}>
          Managers
        </div>
        {units.map((date, idx) => {
          const isCurrentUnit = viewMode === 'Day' ? false : 
                               viewMode === 'Week' ? (new Date() >= date && new Date() < new Date(date.getTime() + 7*24*60*60*1000)) :
                               (new Date().getMonth() === date.getMonth() && new Date().getFullYear() === date.getFullYear());
          
          let label = '';
          let subLabel = '';
          
          if (viewMode === 'Day') {
            label = date.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0);
            subLabel = date.getDate();
          } else if (viewMode === 'Week') {
            label = 'WK';
            const weekNum = Math.ceil(date.getDate() / 7);
            subLabel = `Week ${weekNum}`;
          } else {
            label = date.toLocaleDateString('en-US', { month: 'short' });
            subLabel = date.getFullYear();
          }

          return (
            <div key={idx} style={{ 
              width: cellWidth, flexShrink: 0, 
              padding: '8px 0', textAlign: 'center', 
              fontSize: '10px', color: isCurrentUnit ? 'var(--accent)' : 'var(--tx2)',
              background: isCurrentUnit ? 'var(--accent-soft)' : 'transparent',
              borderRight: '1px solid var(--bd-l)', fontWeight: isCurrentUnit ? 700 : 500,
              display: 'flex', flexDirection: 'column', justifyContent: 'center'
            }}>
              <div>{label}</div>
              <div style={{ fontSize: '11px', fontWeight: isCurrentUnit ? 700 : 600 }}>{subLabel}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
