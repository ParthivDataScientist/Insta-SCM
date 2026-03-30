import React, { useState, useMemo } from 'react';
import ProjectBar from './ProjectBar';
import { formatDateDisplay } from '../../utils/dateUtils';
import { Trash2 } from 'lucide-react';

/**
 * ManagerRow Component
 * Renders a row with Sticky label + Scrollable project track
 */
export default function ManagerRow({ 
  managerData, 
  timelineStart, 
  units, 
  cellWidth, 
  viewMode,
  onProjectClick,
  onReassign,
  onRemoveManager,
  onDateUpdate
}) {
  const rawManager = managerData.manager;
  const managerId = typeof rawManager === 'string' ? null : rawManager?.id;
  const managerStr = typeof rawManager === 'string' ? rawManager : (rawManager?.full_name || rawManager?.name || 'Unknown');
  const allocations = managerData.allocations || managerData.projects || [];
  const [isOver, setIsOver] = useState(false);

  // Group allocations into vertical levels to prevent overlap
  const stackedAllocations = useMemo(() => {
    const sorted = [...allocations].sort((a, b) => {
      const startA = new Date(a.allocation_start_date || a.dispatch_date || a.event_start_date || 0);
      const startB = new Date(b.allocation_start_date || b.dispatch_date || b.event_start_date || 0);
      return startA - startB;
    });

    const levels = [];
    return sorted.map((alloc) => {
      const sDate = alloc.allocation_start_date || alloc.dispatch_date || alloc.event_start_date;
      const eDate = alloc.allocation_end_date || alloc.dismantling_date;
      
      let levelIdx = 0;
      while (true) {
        if (!levels[levelIdx]) {
          levels[levelIdx] = eDate;
          break;
        } else {
          // If the new project starts after the current level's last end date, stack it here
          if (new Date(sDate) >= new Date(levels[levelIdx])) {
            levels[levelIdx] = eDate;
            break;
          }
        }
        levelIdx++;
      }
      return { ...alloc, levelIndex: levelIdx };
    });
  }, [allocations]);

  const rowHeight = Math.max(48, Math.max(...stackedAllocations.map(a => a.levelIndex + 1), 1) * 36 + 12);

  // Calculate Next Available Date
  const lastDismantle = allocations.reduce((latest, p) => {
    const endStr = p.allocation_end_date || p.dismantling_date;
    if (!endStr) return new Date(8640000000000000); // Indefinite
    const d = new Date(endStr);
    return d > latest ? d : latest;
  }, new Date(0));

  const nextAvailableStr = lastDismantle.getTime() > 8640000000000000 / 2 
    ? 'TBD' 
    : formatDateDisplay(lastDismantle.toISOString().split('T')[0]);

  // Drag and Drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsOver(true);
  };

  const handleDragLeave = () => setIsOver(false);

  const strToUTC = (dateStr) => {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    if (parts.length !== 3) return new Date(dateStr);
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsOver(false);
    const projectId = e.dataTransfer.getData('projectId');
    const sourcePMId = e.dataTransfer.getData('sourcePMId');

    const startDragX = parseInt(e.dataTransfer.getData('startDragX') || '0', 10);
    const endDragX = e.clientX;
    const deltaX = startDragX > 0 ? endDragX - startDragX : 0;
    const pxPerDay = viewMode === 'Day' ? cellWidth : viewMode === 'Week' ? (cellWidth / 7) : (cellWidth / 30);
    const deltaDays = Math.round(deltaX / pxPerDay);

    if (sourcePMId !== String(managerId)) {
      // Reassign action using IDs
      onReassign(projectId, managerId);
    } else if (deltaDays !== 0 && projectId) {
      // Time shift within the same row
      const alloc = allocations.find(a => a.id == projectId || (a.project && a.project.id == projectId));
      if (alloc) {
          const sDate = strToUTC(alloc.allocation_start_date || alloc.dispatch_date || alloc.event_start_date);
          const eDate = strToUTC(alloc.allocation_end_date || alloc.dismantling_date || alloc.allocation_start_date || alloc.dispatch_date || alloc.event_start_date);
          
          sDate.setUTCDate(sDate.getUTCDate() + deltaDays);
          eDate.setUTCDate(eDate.getUTCDate() + deltaDays);
          
          onDateUpdate(projectId, { 
             allocation_start_date: sDate.toISOString().split('T')[0],
             allocation_end_date: eDate.toISOString().split('T')[0]
          });
      }
    }
  };

  return (
    <div 
      className="gantt-row"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ 
        display: 'flex', borderBottom: '1px solid var(--bd-l)', 
        minHeight: '48px', height: `${rowHeight}px`, position: 'relative',
        background: isOver ? 'var(--red-ghost)' : 'transparent',
        transition: 'background 0.2s ease, height 0.3s ease'
      }}
    >
      {/* Manager Name Label */}
      <div style={{ 
        width: '240px', flexShrink: 0, 
        padding: '12px 16px', borderRight: '1px solid var(--bd)', 
        background: 'var(--bg-card)', position: 'sticky', left: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tx)' }}>{managerStr}</div>
          <div style={{ fontSize: '10px', color: 'var(--tx3)', fontWeight: 600 }}>Next: <span style={{ color: 'var(--green)' }}>{nextAvailableStr}</span></div>
        </div>
        
        <button 
          className="icon-btn" 
          onClick={() => onRemoveManager(managerId || managerStr)}
          style={{ color: 'var(--red)', padding: '4px' }}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Track Grid */}
      <div style={{ position: 'relative', display: 'flex', flexGrow: 1 }}>
        {units.map((_, idx) => (
          <div key={idx} style={{ 
            width: cellWidth, borderRight: '1.5px solid var(--bd-l)', 
            height: '100%', opacity: 0.3, flexShrink: 0
          }} />
        ))}

        {/* Project Bars */}
        {stackedAllocations.map((alloc, idx) => (
          <ProjectBar 
            key={alloc.id || idx}
            allocation={{
                ...alloc, 
                allocation_start_date: alloc.allocation_start_date || alloc.dispatch_date || alloc.event_start_date,
                allocation_end_date: alloc.allocation_end_date || alloc.dismantling_date
            }}
            timelineStart={timelineStart}
            cellWidth={cellWidth}
            viewMode={viewMode}
            levelIndex={alloc.levelIndex}
            onClick={onProjectClick}
            onDateUpdate={onDateUpdate}
          />
        ))}
      </div>
    </div>
  );
}
