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

export default function ProjectBar({
  allocation,
  timelineStart,
  cellWidth,
  viewMode = 'Day',
  levelIndex = 0,
  currentManagerId = null,
  onClick,
  onAllocationCommit,
}) {
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
          const previewStartDate = pxToTimelineDate(rawStartPx, timelineStart, cellWidth, viewMode);
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
            translateY: event.clientY - interaction.pointerStartY,
            dropTarget,
          };
        }
      } else if (interaction.mode === 'resize-left') {
        const resizedStart = pxToTimelineDate(
          interaction.baseLayout.left + (event.clientX - interaction.pointerStartX),
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
        const resizedEnd = pxToTimelineDate(
          Math.max(
            interaction.baseLayout.left,
            interaction.baseLayout.left +
              interaction.baseLayout.width +
              (event.clientX - interaction.pointerStartX) -
              1
          ),
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

    interactionRef.current = {
      mode,
      pointerStartX: event.clientX,
      pointerStartY: event.clientY,
      pointerOffsetX: event.clientX - wrapperRect.left,
      originTrack,
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

  const barColor =
    allocation.allocation_end_date || allocation.dismantling_date
      ? allocation.hasConflict
        ? 'var(--red)'
        : 'var(--blu)'
      : 'var(--org)';
  const barBackground =
    allocation.allocation_end_date || allocation.dismantling_date
      ? allocation.hasConflict
        ? 'var(--red-ghost)'
        : 'var(--b-bg)'
      : 'var(--o-bg)';
  const barBorder =
    allocation.allocation_end_date || allocation.dismantling_date
      ? allocation.hasConflict
        ? 'var(--red-v)'
        : 'var(--b-bd)'
      : 'var(--o-bd)';

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
        top: `${8 + levelIndex * 40}px`,
        left: `${baseLayout.left}px`,
        width: `${baseLayout.width}px`,
        height: '32px',
        zIndex: isInteracting || showTooltip ? 60 : 3,
        cursor: isDragging ? 'grabbing' : isInteracting ? 'col-resize' : 'grab',
        opacity: isDragging ? 0.92 : 1,
        willChange: isInteracting ? 'transform, width' : 'auto',
        transform: 'translate3d(0px, 0px, 0px)',
        transition: isInteracting
          ? 'none'
          : 'left 0.24s cubic-bezier(.22,1,.36,1), width 0.24s cubic-bezier(.22,1,.36,1), transform 0.16s ease',
        filter: isInteracting ? 'drop-shadow(0 10px 22px rgba(0,0,0,0.18))' : 'none',
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
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
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
              Dispatch:
            </span>
            <span style={{ fontWeight: 600, color: 'var(--org)' }}>{project.dispatch_date || 'TBD'}</span>

            <span style={{ color: 'var(--tx3)', fontWeight: 700, textTransform: 'uppercase', fontSize: '10px' }}>
              Show Dates:
            </span>
            <span style={{ fontWeight: 600, color: 'var(--blu)' }}>
              {project.event_start_date || 'TBD'} - {project.event_end_date || 'TBD'}
            </span>

            <span style={{ color: 'var(--tx3)', fontWeight: 700, textTransform: 'uppercase', fontSize: '10px' }}>
              Location:
            </span>
            <span style={{ fontWeight: 600 }}>
              {project.venue || '-'} ({project.branch || '-'})
            </span>

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
          background: rgba(0, 0, 0, 0.08);
        }

        .l-resizer {
          left: -5px;
        }

        .r-resizer {
          right: -5px;
        }

        .active-handle {
          background: var(--red) !important;
          width: 4px !important;
          box-shadow: 0 0 10px var(--red);
        }
      `}</style>
    </div>
  );
}
