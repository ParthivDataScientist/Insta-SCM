import React, { useState, useEffect, useRef } from 'react';

/**
 * ProjectBar Component
 * Renders a clickable and resizable project bar on the timeline track.
 */
export default function ProjectBar({ 
  allocation, 
  timelineStart,
  cellWidth,
  viewMode = 'Day',
  levelIndex = 0, 
  onClick, 
  onDateUpdate 
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [isResizing, setIsResizing] = useState(null); // 'left' | 'right' | null
  const [isDragging, setIsDragging] = useState(false);
  
  // Local transient state for the visual bar during drag
  const [viewLeft, setViewLeft] = useState(0);
  const [viewWidth, setViewWidth] = useState(0);

  // Stable callback ref to avoid effect recreation tracking
  const onDateUpdateRef = useRef(onDateUpdate);
  useEffect(() => {
    onDateUpdateRef.current = onDateUpdate;
  }, [onDateUpdate]);

  // Refs for tracking drag without triggering re-renders inside handlers
  const resizeStateRef = useRef({
    side: null,
    startX: 0,
    startLeft: 0,
    startWidth: 0
  });

  // Convert a local date to UTC midnight (e.g., matching its Y-M-D values)
  const localToUTC = (localDate) => {
    return new Date(Date.UTC(localDate.getFullYear(), localDate.getMonth(), localDate.getDate()));
  };

  // Convert "YYYY-MM-DD" directly to a UTC Date Object correctly
  const strToUTC = (dateStr) => {
    if (!dateStr) return localToUTC(new Date());
    const parts = dateStr.split('-');
    if (parts.length !== 3) return localToUTC(new Date(dateStr));
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  };

  const getDaysInMonthUTC = (year, monthIndex) => {
    return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  };

  const daysBetweenUTC = (fromDate, toDate) => {
    return Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getPxPerDayAtDate = (dateObj) => {
    if (viewMode === 'Day') return cellWidth;
    if (viewMode === 'Week') return cellWidth / 7;

    // Month mode keeps a fixed width per month, so px/day varies by month length.
    const daysInMonth = getDaysInMonthUTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth());
    return cellWidth / daysInMonth;
  };

  const dateToPx = (dateObj) => {
    const tS = localToUTC(new Date(timelineStart));
    if (viewMode !== 'Month') {
      const dayOffset = daysBetweenUTC(tS, dateObj);
      const pxPerDay = getPxPerDayAtDate(dateObj);
      return dayOffset * pxPerDay;
    }

    // Month mode: sum per-month proportional widths for better alignment.
    const cursor = new Date(tS.getTime());
    let px = 0;

    while (cursor.getUTCFullYear() < dateObj.getUTCFullYear() ||
           (cursor.getUTCFullYear() === dateObj.getUTCFullYear() && cursor.getUTCMonth() < dateObj.getUTCMonth())) {
      const daysInCursorMonth = getDaysInMonthUTC(cursor.getUTCFullYear(), cursor.getUTCMonth());
      px += cellWidth;
      cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);
      if (daysInCursorMonth === 0) break;
    }

    if (cursor.getUTCFullYear() === dateObj.getUTCFullYear() && cursor.getUTCMonth() === dateObj.getUTCMonth()) {
      const dayInMonth = dateObj.getUTCDate() - 1;
      px += dayInMonth * getPxPerDayAtDate(dateObj);
    }

    return px;
  };

  // Internal helper to convert dates to current pixel positions
  const getProjectLayout = () => {
    const pS = strToUTC(allocation.allocation_start_date);
    const pE = allocation.allocation_end_date 
                 ? strToUTC(allocation.allocation_end_date)
                 : localToUTC(new Date());

    const durationDays = daysBetweenUTC(pS, pE) + 1;
    const pxPerDay = getPxPerDayAtDate(pS);

    return {
      left: dateToPx(pS),
      width: Math.max(10, durationDays * pxPerDay)
    };
  };

  // Sync with project props only when NOT actively resizing
  useEffect(() => {
    if (!isResizing) {
      const layout = getProjectLayout();
      setViewLeft(layout.left);
      setViewWidth(layout.width);
    }
  }, [allocation.allocation_start_date, allocation.allocation_end_date, cellWidth, timelineStart, isResizing, viewMode]);

  const pxToDeltaDays = (deltaPx) => {
    if (viewMode === 'Day') return Math.round(deltaPx / cellWidth);
    if (viewMode === 'Week') return Math.round(deltaPx / (cellWidth / 7));
    return Math.round(deltaPx / (cellWidth / 30));
  };

  // Handler: User clicks a resize handle
  const onHandleMouseDown = (e, side) => {
    e.stopPropagation();
    e.preventDefault();
    
    const currentLayout = getProjectLayout();
    
    resizeStateRef.current = {
      side,
      startX: e.clientX,
      startLeft: currentLayout.left,
      startWidth: currentLayout.width
    };

    setIsResizing(side);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e) => {
      const state = resizeStateRef.current;
      // Smooth pixel tracking directly from the mouse coordinates!
      const deltaX = e.clientX - state.startX;
      const smoothDeltaPx = deltaX;

      if (state.side === 'right') {
        const nextWidth = Math.max(10, state.startWidth + smoothDeltaPx); // Allow smooth compression down to 10px before logical minimums apply
        setViewWidth(nextWidth);
      } else if (state.side === 'left') {
        const nextWidth = Math.max(10, state.startWidth - smoothDeltaPx);
        const actualDeltaPx = state.startWidth - nextWidth;
        const nextLeft = state.startLeft + actualDeltaPx;
        
        setViewLeft(nextLeft);
        setViewWidth(nextWidth);
      }
    };

    const handleMouseUp = (e) => {
      const state = resizeStateRef.current;
      const deltaX = e.clientX - state.startX;
      const deltaDays = pxToDeltaDays(deltaX);
      const deltaPx = deltaDays * (viewMode === 'Day' ? cellWidth : viewMode === 'Week' ? (cellWidth / 7) : (cellWidth / 30));

      let finalLeft = state.startLeft;
      let finalWidth = state.startWidth;

      // Match the visual clamping bounds exactly logically
      if (state.side === 'right') {
        finalWidth = Math.max(cellWidth, state.startWidth + deltaPx);
      } else if (state.side === 'left') {
        finalWidth = Math.max(cellWidth, state.startWidth - deltaPx);
        const actualDeltaPx = state.startWidth - finalWidth;
        finalLeft = state.startLeft + actualDeltaPx;
      }
      
      const pxDeltaLeft = finalLeft - state.startLeft;
      const pxDeltaWidth = finalWidth - state.startWidth;

      const deltaDaysLeft = pxToDeltaDays(pxDeltaLeft);
      const deltaDaysWidth = pxToDeltaDays(pxDeltaWidth);

      // Mutate the original UTC dates directly for absolute precision
      const sDate = strToUTC(allocation.allocation_start_date);
      const eDate = allocation.allocation_end_date 
                      ? strToUTC(allocation.allocation_end_date) 
                      : strToUTC(allocation.allocation_start_date);
      
      // Compute Shifts
      sDate.setUTCDate(sDate.getUTCDate() + deltaDaysLeft);
      // Ensure eDate moves with the left shift AND any width changes
      eDate.setUTCDate(eDate.getUTCDate() + deltaDaysLeft + deltaDaysWidth);

      const formatDateUTC = (d) => d.toISOString().split('T')[0];

      // Visually SNAP to the grid location immediately!
      // This combined with 'isResizing: null' restores the 0.15s CSS transition
      // so the bar "glides" into the snapped slot like a premium UI.
      setViewLeft(finalLeft);
      setViewWidth(finalWidth);

      // Trigger update via ref to avoid dependency cycles and effect reconstruction
      onDateUpdateRef.current(allocation.id, {
        allocation_start_date: formatDateUTC(sDate),
        allocation_end_date: formatDateUTC(eDate)
      });

      setIsResizing(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, cellWidth, allocation.id, viewMode]);

  const project = allocation.project || allocation;
  const bColor = allocation.allocation_end_date || allocation.dismantling_date ? (allocation.hasConflict ? 'var(--red)' : 'var(--blu)') : 'var(--org)';
  const bBg = allocation.allocation_end_date || allocation.dismantling_date ? (allocation.hasConflict ? 'var(--red-ghost)' : 'var(--b-bg)') : 'var(--o-bg)';
  const bBd = allocation.allocation_end_date || allocation.dismantling_date ? (allocation.hasConflict ? 'var(--red-v)' : 'var(--b-bd)') : 'var(--o-bd)';

  return (
    <div 
      className={`gantt-bar-wrap ${isResizing ? 'is-resizing' : ''}`}
      draggable={!isResizing}
      onDragStart={(e) => {
        e.dataTransfer.setData('projectId', project.id);
        e.dataTransfer.setData('sourcePM', allocation.manager_id || project.project_manager || 'Unassigned');
        e.dataTransfer.setData('startDragX', e.clientX);
        setIsDragging(true);
      }}
      onDragEnd={() => setIsDragging(false)}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      style={{
        position: 'absolute',
        top: `${8 + (levelIndex * 40)}px`,
        left: viewLeft,
        width: viewWidth,
        height: '32px',
        zIndex: isResizing || showTooltip ? 50 : 2,
        cursor: isResizing ? 'col-resize' : 'grab',
        opacity: isDragging ? 0.5 : 1,
        // Critical: NO CSS transition while actively resizing, otherwise it fights the mouse
        transition: isResizing ? 'none' : 'left 0.28s cubic-bezier(.22,1,.36,1), width 0.28s cubic-bezier(.22,1,.36,1), transform 0.2s ease',
        filter: isResizing ? 'drop-shadow(0 0 8px var(--red))' : 'none'
      }}
    >
      <div 
        onMouseDown={(e) => onHandleMouseDown(e, 'left')} 
        className={`g-resize-handle l-resizer ${isResizing === 'left' ? 'active-handle' : ''}`} 
      />
      <div 
        onMouseDown={(e) => onHandleMouseDown(e, 'right')} 
        className={`g-resize-handle r-resizer ${isResizing === 'right' ? 'active-handle' : ''}`} 
      />

      <div 
        className="gantt-bar-inner"
        onClick={(e) => { e.stopPropagation(); onClick(project); }}
        style={{
          width: '100%', height: '100%', pointerEvents: 'none',
          background: bBg, border: `2px ${isResizing ? 'dashed' : 'solid'} ${bBd}`, borderRadius: '6px',
          padding: '0 10px', display: 'flex', alignItems: 'center',
          fontSize: '11px', fontWeight: 800, color: bColor, overflow: 'hidden'
        }}
      >
        <div style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
          {project.project_name || 'Unnamed Project'} <span style={{ opacity: 0.6, fontSize: '9px' }}>• {project.venue || project.branch}</span>
        </div>
      </div>

      {showTooltip && !isResizing && !isDragging && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '10px',
          marginTop: '8px',
          background: 'var(--bg)',
          border: '1px solid var(--bd)',
          borderRadius: '8px',
          padding: '12px',
          width: 'max-content',
          minWidth: '200px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          color: 'var(--tx)',
          fontSize: '11px',
          pointerEvents: 'none'
        }}>
          <div style={{ fontWeight: 800, fontSize: '13px', borderBottom: '1px solid var(--bd-l)', paddingBottom: '6px', marginBottom: '2px' }}>
            {project.project_name || 'Unnamed Project'}
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', alignItems: 'center' }}>
             <span style={{ color: 'var(--tx3)', fontWeight: 700, textTransform: 'uppercase', fontSize: '10px' }}>Dispatch:</span>
             <span style={{ fontWeight: 600, color: 'var(--org)' }}>{project.material_dispatch_date || 'TBD'}</span>

             <span style={{ color: 'var(--tx3)', fontWeight: 700, textTransform: 'uppercase', fontSize: '10px' }}>Show Dates:</span>
             <span style={{ fontWeight: 600, color: 'var(--blu)' }}>{project.event_start_date || 'TBD'} — {project.event_end_date || 'TBD'}</span>
             
             <span style={{ color: 'var(--tx3)', fontWeight: 700, textTransform: 'uppercase', fontSize: '10px' }}>Location:</span>
             <span style={{ fontWeight: 600 }}>{project.venue || '-'} ({project.branch || '-'})</span>
             
             <span style={{ color: 'var(--tx3)', fontWeight: 700, textTransform: 'uppercase', fontSize: '10px' }}>Stage:</span>
             <span style={{ fontWeight: 700 }}>{project.stage || '-'}</span>
          </div>
        </div>
      )}

      <style>{`
        .g-resize-handle {
          position: absolute; top: 0; bottom: 0; width: 10px; z-index: 10;
          cursor: ew-resize; background: transparent; transition: all 0.2s;
        }
        .g-resize-handle:hover { background: rgba(0,0,0,0.1); }
        .l-resizer { left: -5px; }
        .r-resizer { right: -5px; }
        .active-handle {
          background: var(--red) !important;
          width: 4px !important;
          left: ${isResizing === 'left' ? '0' : 'auto'};
          right: ${isResizing === 'right' ? '0' : 'auto'};
          box-shadow: 0 0 10px var(--red);
        }
      `}</style>
    </div>
  );
}
