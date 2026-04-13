import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDaysUTC,
  diffDaysUTC,
  formatUTCDate,
  getBarLayout,
  parseUTCDate,
  pxToTimelineDate,
} from './timelineMath';

const DRAG_THRESHOLD_PX = 4;
const TRACK_SELECTOR = '[data-gantt-track="true"]';
const TRAY_SELECTOR = '[data-unassigned-tray="true"]';
const SCROLL_CONTAINER_SELECTOR = '[data-gantt-scroll-container="true"]';
const AUTO_SCROLL_EDGE_PX = 96;
const AUTO_SCROLL_STEP_PX = 22;
const STAGE_COLORS = {
  'Design/BOM': { text: 'var(--stage-design-text)', bg: 'var(--stage-design-bg)', border: 'var(--stage-design-border)' },
  Procurement: { text: 'var(--stage-procurement-text)', bg: 'var(--stage-procurement-bg)', border: 'var(--stage-procurement-border)' },
  Production: { text: 'var(--stage-production-text)', bg: 'var(--stage-production-bg)', border: 'var(--stage-production-border)' },
  Dispatch: { text: 'var(--stage-dispatch-text)', bg: 'var(--stage-dispatch-bg)', border: 'var(--stage-dispatch-border)' },
  'Event Installation': { text: 'var(--stage-installation-text)', bg: 'var(--stage-installation-bg)', border: 'var(--stage-installation-border)' },
  Dismantle: { text: 'var(--stage-dismantle-text)', bg: 'var(--stage-dismantle-bg)', border: 'var(--stage-dismantle-border)' },
  'Completed/Closed': { text: 'var(--stage-completed-text)', bg: 'var(--stage-completed-bg)', border: 'var(--stage-completed-border)' },
};

function getDropTarget(clientX, clientY) {
  const element = document.elementFromPoint(clientX, clientY);
  if (!element) return null;

  const tray = element.closest(TRAY_SELECTOR);
  if (tray) {
    return { kind: 'tray', element: tray, row: null, managerId: null, valid: true };
  }

  const track = element.closest(TRACK_SELECTOR);
  if (!track) return null;

  const row = track.closest('.gantt-row');
  const rawManagerId = track.dataset.managerId;
  const managerId = rawManagerId ? Number(rawManagerId) : null;

  return {
    kind: 'track',
    element: track,
    row,
    managerId,
    valid: rawManagerId !== '',
  };
}

function clearDropTarget(target) {
  if (!target) return;

  if (target.kind === 'track' && target.row) {
    delete target.row.dataset.dropState;
  }

  if (target.kind === 'tray' && target.element) {
    delete target.element.dataset.dropState;
  }
}

function markDropTarget(target) {
  if (!target) return;

  if (target.kind === 'track' && target.row) {
    target.row.dataset.dropState = target.valid ? 'active' : 'invalid';
  }

  if (target.kind === 'tray' && target.element) {
    target.element.dataset.dropState = 'active';
  }
}

function getAutoScrollDelta(clientX, scrollContainer) {
  if (!scrollContainer) return 0;

  const rect = scrollContainer.getBoundingClientRect();
  const leftDistance = clientX - rect.left;
  const rightDistance = rect.right - clientX;

  if (leftDistance < AUTO_SCROLL_EDGE_PX) {
    const ratio = (AUTO_SCROLL_EDGE_PX - leftDistance) / AUTO_SCROLL_EDGE_PX;
    return -Math.ceil(AUTO_SCROLL_STEP_PX * ratio);
  }

  if (rightDistance < AUTO_SCROLL_EDGE_PX) {
    const ratio = (AUTO_SCROLL_EDGE_PX - rightDistance) / AUTO_SCROLL_EDGE_PX;
    return Math.ceil(AUTO_SCROLL_STEP_PX * ratio);
  }

  return 0;
}

const ProjectBar = React.memo(({
  allocation,
  timelineStart,
  cellWidth,
  viewMode = 'Day',
  levelIndex = 0,
  currentManagerId = null,
  onClick,
  onAllocationCommit,
}) => {
  const project = allocation.project || allocation;
  const projectId = project.id || allocation.id;
  const startDate = allocation.allocation_start_date;
  const endDate = allocation.allocation_end_date || allocation.allocation_start_date;
  const baseLayout = useMemo(
    () => getBarLayout(startDate, endDate, timelineStart, cellWidth, viewMode),
    [startDate, endDate, timelineStart, cellWidth, viewMode]
  );

  const [showTooltip, setShowTooltip] = useState(false);
  const [interactionMode, setInteractionMode] = useState(null);

  const wrapperRef = useRef(null);
  const interactionRef = useRef(null);
  const onAllocationCommitRef = useRef(onAllocationCommit);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    onAllocationCommitRef.current = onAllocationCommit;
  }, [onAllocationCommit]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || interactionRef.current) return;

    wrapper.style.transform = 'translate3d(0px, 0px, 0px)';
    wrapper.style.width = `${baseLayout.width}px`;
  }, [baseLayout.width]);

  useEffect(() => {
    if (!interactionMode) return undefined;

    const handlePointerMove = (event) => {
      const interaction = interactionRef.current;
      const wrapper = wrapperRef.current;
      if (!interaction || !wrapper) return;

      const movedDistance = Math.hypot(
        event.clientX - interaction.pointerStartX,
        event.clientY - interaction.pointerStartY
      );

      if (movedDistance > DRAG_THRESHOLD_PX) {
        interaction.hasMoved = true;
        suppressClickRef.current = true;
      }

      let preview = null;

      if (interaction.mode === 'drag') {
        const autoScrollDelta = getAutoScrollDelta(event.clientX, interaction.scrollContainer);
        if (autoScrollDelta !== 0 && interaction.scrollContainer) {
          interaction.scrollContainer.scrollLeft += autoScrollDelta;
        }

        const dropTarget = getDropTarget(event.clientX, event.clientY);
        if (dropTarget !== interaction.currentTarget) {
          clearDropTarget(interaction.currentTarget);
          interaction.currentTarget = dropTarget;
          markDropTarget(dropTarget);
        }

        const activeTrack =
          dropTarget?.kind === 'track' && dropTarget.valid ? dropTarget.element : interaction.originTrack;
        const trackRect = activeTrack?.getBoundingClientRect();

        if (trackRect) {
          const rawStartPx = event.clientX - trackRect.left - interaction.pointerOffsetX;
          // SNAP TO GRID
          const snappedStartPx = Math.round(rawStartPx / cellWidth) * cellWidth;
          const previewStartDate = pxToTimelineDate(snappedStartPx, timelineStart, cellWidth, viewMode);
          const previewEndDate = addDaysUTC(previewStartDate, interaction.durationDays);
          const nextLayout = getBarLayout(
            previewStartDate,
            previewEndDate,
            timelineStart,
            cellWidth,
            viewMode
          );

          preview = {
            startDate: previewStartDate,
            endDate: previewEndDate,
            width: nextLayout.width,
            translateX: nextLayout.left - interaction.baseLayout.left,
            translateY:
              dropTarget?.kind === 'track' && dropTarget.row
                ? dropTarget.row.getBoundingClientRect().top - interaction.originRowTop
                : event.clientY - interaction.pointerStartY,
            dropTarget,
          };
        }
      } else if (interaction.mode === 'resize-left') {
        const rawStartPx = interaction.baseLayout.left + (event.clientX - interaction.pointerStartX);
        const snappedStartPx = Math.round(rawStartPx / cellWidth) * cellWidth;
        const resizedStart = pxToTimelineDate(
          snappedStartPx,
          timelineStart,
          cellWidth,
          viewMode
        );
        const boundedStart = resizedStart > interaction.endDate ? interaction.endDate : resizedStart;
        const nextLayout = getBarLayout(
          boundedStart,
          interaction.endDate,
          timelineStart,
          cellWidth,
          viewMode
        );

        preview = {
          startDate: boundedStart,
          endDate: interaction.endDate,
          width: nextLayout.width,
          translateX: nextLayout.left - interaction.baseLayout.left,
          translateY: 0,
          dropTarget: null,
        };
      } else if (interaction.mode === 'resize-right') {
        const rawEndPx = Math.max(
          interaction.baseLayout.left,
          interaction.baseLayout.left +
            interaction.baseLayout.width +
            (event.clientX - interaction.pointerStartX) -
            1
        );
        const snappedEndPx = Math.round(rawEndPx / cellWidth) * cellWidth;
        const resizedEnd = pxToTimelineDate(
          snappedEndPx,
          timelineStart,
          cellWidth,
          viewMode
        );
        const boundedEnd = resizedEnd < interaction.startDate ? interaction.startDate : resizedEnd;
        const nextLayout = getBarLayout(
          interaction.startDate,
          boundedEnd,
          timelineStart,
          cellWidth,
          viewMode
        );

        preview = {
          startDate: interaction.startDate,
          endDate: boundedEnd,
          width: nextLayout.width,
          translateX: 0,
          translateY: 0,
          dropTarget: null,
        };
      }

      interaction.preview = preview;

      if (!interaction.rafId) {
        interaction.rafId = window.requestAnimationFrame(() => {
          const frame = interactionRef.current;
          const framePreview = frame?.preview;
          const bar = wrapperRef.current;

          if (!frame || !framePreview || !bar) {
            if (frame) frame.rafId = 0;
            return;
          }

          bar.style.transform = `translate3d(${framePreview.translateX}px, ${framePreview.translateY}px, 0px)`;
          bar.style.width = `${framePreview.width}px`;
          frame.rafId = 0;
        });
      }
    };

    const handlePointerUp = async () => {
      const interaction = interactionRef.current;
      const wrapper = wrapperRef.current;
      if (!interaction || !wrapper) return;

      if (interaction.rafId) {
        window.cancelAnimationFrame(interaction.rafId);
      }

      clearDropTarget(interaction.currentTarget);
      document.body.style.userSelect = '';

      const preview = interaction.preview;
      const hasMeaningfulMove = interaction.hasMoved && preview;

      interactionRef.current = null;
      setInteractionMode(null);

      wrapper.style.transform = 'translate3d(0px, 0px, 0px)';
      wrapper.style.width = `${baseLayout.width}px`;

      if (!hasMeaningfulMove) {
        return;
      }

      if (interaction.mode === 'drag') {
        const dropTarget = preview.dropTarget;
        if (!dropTarget) return;

        const nextPayload = {};
        if (dropTarget.kind === 'tray') {
          if (currentManagerId !== null) {
            nextPayload.manager_id = null;
          }
        } else if (dropTarget.kind === 'track' && dropTarget.valid) {
          if (dropTarget.managerId !== currentManagerId) {
            nextPayload.manager_id = dropTarget.managerId;
          }
          nextPayload.allocation_start_date = formatUTCDate(preview.startDate);
          nextPayload.allocation_end_date = formatUTCDate(preview.endDate);
        } else {
          return;
        }

        if (Object.keys(nextPayload).length > 0) {
          await onAllocationCommitRef.current(projectId, nextPayload);
        }

        return;
      }

      const nextStart = formatUTCDate(preview.startDate);
      const nextEnd = formatUTCDate(preview.endDate);

      if (nextStart !== formatUTCDate(startDate) || nextEnd !== formatUTCDate(endDate)) {
        await onAllocationCommitRef.current(projectId, {
          allocation_start_date: nextStart,
          allocation_end_date: nextEnd,
        });
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [
    interactionMode,
    timelineStart,
    cellWidth,
    viewMode,
    baseLayout.width,
    currentManagerId,
    projectId,
    startDate,
    endDate,
  ]);

  const beginInteraction = (event, mode) => {
    if (event.button !== 0 || !wrapperRef.current) return;

    event.preventDefault();
    event.stopPropagation();

    const wrapperRect = wrapperRef.current.getBoundingClientRect();
    const originTrack = wrapperRef.current.closest(TRACK_SELECTOR);
    const originRow = wrapperRef.current.closest('.gantt-row');
    const scrollContainer = wrapperRef.current.closest(SCROLL_CONTAINER_SELECTOR);

    interactionRef.current = {
      mode,
      pointerStartX: event.clientX,
      pointerStartY: event.clientY,
      pointerOffsetX: event.clientX - wrapperRect.left,
      originTrack,
      scrollContainer,
      originRowTop: originRow?.getBoundingClientRect().top || wrapperRect.top,
      baseLayout,
      durationDays: diffDaysUTC(startDate, endDate),
      startDate: parseUTCDate(startDate),
      endDate: parseUTCDate(endDate),
      currentTarget: null,
      preview: null,
      hasMoved: false,
      rafId: 0,
    };

    document.body.style.userSelect = 'none';
    setShowTooltip(false);
    setInteractionMode(mode);
  };

  const handleCardClick = (event) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    onClick(project);
  };

  const isDragging = interactionMode === 'drag';
  const isResizingLeft = interactionMode === 'resize-left';
  const isResizingRight = interactionMode === 'resize-right';
  const isInteracting = Boolean(interactionMode);
  const stageColors = STAGE_COLORS[project.board_stage] || STAGE_COLORS['Design/BOM'];
  const barColor = allocation.hasConflict ? 'var(--status-changes-text)' : stageColors.text;
  const barBackground = allocation.hasConflict ? 'var(--status-changes-bg)' : stageColors.bg;
  const barBorder = allocation.hasConflict ? 'var(--status-changes-text)' : stageColors.border;

  return (
    <div
      ref={wrapperRef}
      className={`gantt-bar-wrap${isInteracting ? ' is-interacting' : ''}`}
      onPointerDown={(event) => beginInteraction(event, 'drag')}
      onMouseEnter={() => !isInteracting && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={handleCardClick}
      style={{
        position: 'absolute',
        top: `${14 + levelIndex * 48}px`,
        left: `${baseLayout.left}px`,
        width: `${baseLayout.width}px`,
        height: '34px',
        zIndex: isInteracting || showTooltip ? 60 : 3,
        cursor: isDragging ? 'grabbing' : isInteracting ? 'col-resize' : 'grab',
        opacity: isDragging ? 0.92 : 1,
        willChange: isInteracting ? 'transform, width' : 'auto',
        transform: 'translate3d(0px, 0px, 0px)',
        transition: isInteracting
          ? 'none'
          : 'left 0.24s cubic-bezier(.22,1,.36,1), width 0.24s cubic-bezier(.22,1,.36,1), transform 0.16s ease',
        filter: isInteracting ? 'drop-shadow(var(--shadow-strong))' : 'none',
        touchAction: 'none',
      }}
    >
      <div
        onPointerDown={(event) => beginInteraction(event, 'resize-left')}
        className={`g-resize-handle l-resizer${isResizingLeft ? ' active-handle' : ''}`}
      />
      <div
        onPointerDown={(event) => beginInteraction(event, 'resize-right')}
        className={`g-resize-handle r-resizer${isResizingRight ? ' active-handle' : ''}`}
      />

      <div
        className="gantt-bar-inner"
        style={{
          width: '100%',
          height: '100%',
          background: barBackground,
          border: `2px ${isInteracting ? 'dashed' : 'solid'} ${barBorder}`,
          borderRadius: '6px',
          padding: '0 10px',
          display: 'flex',
          alignItems: 'center',
          fontSize: '11px',
          fontWeight: 800,
          color: barColor,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <div style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
          {project.project_name || 'Unnamed Project'}{' '}
          <span style={{ opacity: 0.6, fontSize: '9px' }}>
            {project.venue || project.branch || 'No location'}
          </span>
        </div>
      </div>

      {showTooltip && !isInteracting && (
        <div
          style={{
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
            boxShadow: 'var(--shadow-strong)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            color: 'var(--tx)',
            fontSize: '11px',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              fontWeight: 800,
              fontSize: '13px',
              borderBottom: '1px solid var(--bd-l)',
              paddingBottom: '6px',
              marginBottom: '2px',
            }}
          >
            {project.project_name || 'Unnamed Project'}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: '4px 12px',
              alignItems: 'center',
            }}
          >
            <span style={{ color: 'var(--tx3)', fontWeight: 700, textTransform: 'uppercase', fontSize: '10px' }}>
              Timeline:
            </span>
            <span style={{ fontWeight: 600, color: 'var(--org)' }}>
              {formatUTCDate(startDate)} - {formatUTCDate(endDate)}
            </span>

            <span style={{ color: 'var(--tx3)', fontWeight: 700, textTransform: 'uppercase', fontSize: '10px' }}>
              Completion:
            </span>
            <span style={{ fontWeight: 600, color: 'var(--blu)' }}>{project.completion_percent ?? 0}%</span>

            <span style={{ color: 'var(--tx3)', fontWeight: 700, textTransform: 'uppercase', fontSize: '10px' }}>
              Manager:
            </span>
            <span style={{ fontWeight: 600 }}>{allocation.manager_name || 'Unassigned'}</span>

            <span style={{ color: 'var(--tx3)', fontWeight: 700, textTransform: 'uppercase', fontSize: '10px' }}>
              Stage:
            </span>
            <span style={{ fontWeight: 700 }}>{project.stage || '-'}</span>
          </div>
        </div>
      )}

      <style>{`
        .g-resize-handle {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 10px;
          z-index: 10;
          cursor: ew-resize;
          background: transparent;
          transition: background 0.2s ease;
        }

        .g-resize-handle:hover {
          background: color-mix(in srgb, var(--text-primary) 12%, transparent);
        }

        .l-resizer {
          left: -5px;
        }

        .r-resizer {
          right: -5px;
        }

        .active-handle {
          background: var(--danger);
          width: 4px;
          box-shadow: 0 0 10px color-mix(in srgb, var(--danger) 55%, transparent);
        }
      `}</style>
    </div>
  );
});

export default ProjectBar;
