import React, { useMemo, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import ProjectBar from './ProjectBar';
import { formatDateDisplay } from '../../utils/dateUtils';
import {
  addDaysUTC,
  diffDaysUTC,
  formatUTCDate,
  parseUTCDate,
  pxToTimelineDate,
} from './timelineMath';

const getAllocationStart = (allocation) =>
  allocation.allocation_start_date || allocation.dispatch_date || allocation.event_start_date;

const getAllocationEnd = (allocation) =>
  allocation.allocation_end_date ||
  allocation.dismantling_date ||
  allocation.event_end_date ||
  getAllocationStart(allocation);

export default function ManagerRow({
  managerData,
  timelineStart,
  units,
  cellWidth,
  viewMode,
  onProjectClick,
  onAllocationCommit,
  onRemoveManager,
  hasConflict = false,
  onExternalDrop,
  nowDate = new Date(),
}) {
  const rawManager = managerData.manager;
  const managerId = typeof rawManager === 'string' ? null : rawManager?.id ?? null;
  const managerLabel =
    typeof rawManager === 'string'
      ? rawManager
      : rawManager?.full_name || rawManager?.name || 'Unknown';
  const allocations = managerData.allocations || managerData.projects || [];
  const rowRef = useRef(null);
  const trackRef = useRef(null);
  const { setNodeRef, isOver } = useDroppable({
    id: `manager-row-${managerId ?? 'unassigned'}`,
    disabled: managerId === null,
  });

  const stackedAllocations = useMemo(() => {
    const sorted = [...allocations].sort((left, right) => {
      const leftStart = parseUTCDate(getAllocationStart(left));
      const rightStart = parseUTCDate(getAllocationStart(right));
      return leftStart - rightStart;
    });

    const levels = [];
    return sorted.map((allocation) => {
      const startDate = parseUTCDate(getAllocationStart(allocation));
      const endDate = parseUTCDate(getAllocationEnd(allocation));

      let levelIndex = 0;
      while (true) {
        if (!levels[levelIndex] || startDate > levels[levelIndex]) {
          levels[levelIndex] = endDate;
          return { ...allocation, levelIndex };
        }

        levelIndex += 1;
      }
    });
  }, [allocations]);

  const rowHeight = Math.max(
    76,
    Math.max(...stackedAllocations.map((allocation) => allocation.levelIndex + 1), 1) * 48 + 22
  );

  const remainingAllocations = allocations.filter((allocation) => {
    const endValue = getAllocationEnd(allocation);
    if (!endValue) return false;
    return parseUTCDate(endValue) >= parseUTCDate(nowDate);
  });

  const lastDismantle = remainingAllocations.reduce((latest, allocation) => {
    const endValue = getAllocationEnd(allocation);
    if (!endValue) return latest;

    const endDate = parseUTCDate(endValue);
    return endDate > latest ? endDate : latest;
  }, new Date(0));

  const nextAvailableStr =
    lastDismantle.getTime() === 0
      ? 'Open'
      : formatDateDisplay(formatUTCDate(addDaysUTC(lastDismantle, 1)));

  const markNativeDropState = (state) => {
    if (!rowRef.current) return;

    if (state) {
      rowRef.current.dataset.dropState = state;
      return;
    }

    delete rowRef.current.dataset.dropState;
  };

  const handleDragOver = (event) => {
    if (!event.dataTransfer.types.includes('projectId')) return;
    event.preventDefault();
    markNativeDropState(managerId === null ? 'invalid' : 'active');
  };

  const handleDragLeave = () => {
    markNativeDropState(null);
  };

  const handleDrop = async (event) => {
    if (!event.dataTransfer.types.includes('projectId')) return;

    event.preventDefault();
    markNativeDropState(null);

    if (!trackRef.current || managerId === null) return;

    const projectId = Number(event.dataTransfer.getData('projectId'));
    if (!projectId) return;

    const rawStartDate = event.dataTransfer.getData('timelineStartDate');
    const rawEndDate = event.dataTransfer.getData('timelineEndDate');
    const durationDays = Number(
      event.dataTransfer.getData('timelineDurationDays') ||
        diffDaysUTC(rawStartDate || new Date(), rawEndDate || rawStartDate || new Date())
    );

    const trackRect = trackRef.current.getBoundingClientRect();
    const rawPx = event.clientX - trackRect.left;
    const nextStartDate = pxToTimelineDate(rawPx, timelineStart, cellWidth, viewMode);
    const nextEndDate = addDaysUTC(nextStartDate, Math.max(0, durationDays));

    await onAllocationCommit(projectId, {
      manager_id: managerId,
      allocation_start_date: formatUTCDate(nextStartDate),
      allocation_end_date: formatUTCDate(nextEndDate),
    });
  };

  return (
    <div
      ref={(node) => {
        rowRef.current = node;
        setNodeRef(node);
      }}
      className="gantt-row"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        display: 'flex',
        borderBottom: '1px solid var(--bd-l)',
        minHeight: '48px',
        height: `${rowHeight}px`,
        position: 'relative',
        transition: 'height 0.24s ease, box-shadow 0.2s ease, background 0.2s ease',
        background: isOver ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : undefined,
      }}
    >
      <div
        style={{
          width: '260px',
          flexShrink: 0,
          padding: '12px 16px',
          borderRight: '1px solid var(--bd)',
          background: 'var(--bg-surface-elevated)',
          position: 'sticky',
          left: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '14px', fontWeight: 800, color: hasConflict ? 'var(--status-changes-text)' : 'var(--tx)' }}>
            {managerLabel}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--tx3)', fontWeight: 700 }}>
            {remainingAllocations.length} Projects
          </div>
          <div style={{ fontSize: '10px', color: 'var(--tx3)', fontWeight: 600 }}>
            Next: <span style={{ color: hasConflict ? 'var(--status-changes-text)' : 'var(--success)' }}>{nextAvailableStr}</span>
          </div>
        </div>

        <button
          className="icon-btn"
          onClick={() => onRemoveManager?.(managerId || managerLabel)}
          style={{ color: 'var(--red)', padding: '4px' }}
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div
        ref={trackRef}
        data-gantt-track="true"
        data-manager-id={managerId ?? ''}
        style={{ position: 'relative', display: 'flex', flexGrow: 1 }}
      >
        {units.map((_, index) => (
          <div
            key={index}
            style={{
              width: cellWidth,
              borderRight: '1px solid var(--grid-line)',
              height: '100%',
              opacity: 1,
              flexShrink: 0,
            }}
          />
        ))}

        {stackedAllocations.map((allocation, index) => (
          <ProjectBar
            key={allocation.project?.id || allocation.id || index}
            allocation={{
              ...allocation,
              id: allocation.project?.id || allocation.id,
              manager_id: allocation.manager_id ?? managerId,
              manager_name: managerLabel,
              allocation_start_date: getAllocationStart(allocation),
              allocation_end_date: getAllocationEnd(allocation),
            }}
            timelineStart={timelineStart}
            cellWidth={cellWidth}
            viewMode={viewMode}
            levelIndex={allocation.levelIndex}
            currentManagerId={managerId}
            onClick={onProjectClick}
            onAllocationCommit={onAllocationCommit}
          />
        ))}
      </div>
    </div>
  );
}
