import React, { useState } from 'react';
import { Briefcase, Grab } from 'lucide-react';
import { diffDaysUTC } from './timelineMath';

/**
 * UnassignedTray Component
 * A sidebar that holds projects currently without managers.
 */
export default function UnassignedTray({ projects, onProjectClick, onDropReassign }) {
  const [isOver, setIsOver] = useState(false);

  const getProjectStart = (project) =>
    project.dispatch_date || project.allocation_start_date || project.event_start_date;

  const getProjectEnd = (project) =>
    project.dismantling_date ||
    project.allocation_end_date ||
    project.event_end_date ||
    getProjectStart(project);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsOver(true);
  };

  const handleDragLeave = () => setIsOver(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsOver(false);
    const projectId = e.dataTransfer.getData('projectId');
    const sourcePMId = e.dataTransfer.getData('sourcePMId');

    // If it was already in unassigned, skip
    if (sourcePMId !== '0') {
      onDropReassign(projectId, null);
    }
  };

  return (
    <div 
      className="premium-unassigned-tray"
      data-unassigned-tray="true"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ background: isOver ? 'var(--accent-soft)' : '#ffffff' }}
    >
      <div className="premium-unassigned-tray__header">
        <div className="premium-unassigned-tray__title">
          <Briefcase size={16} />
          Unassigned
          <span style={{ color: 'var(--tx3)', fontWeight: 600 }}>({projects?.length || 0})</span>
        </div>
        <p className="premium-unassigned-tray__meta">Drag here to remove a manager assignment.</p>
      </div>

      <div className="premium-unassigned-tray__body no-scrollbar">
        {!projects || projects.length === 0 ? (
          <div className="premium-column__empty">
            No unassigned projects.
          </div>
        ) : (
          projects.map((p) => (
            <div 
              key={p.id}
              draggable
              onDragStart={(e) => {
                const startDate = getProjectStart(p);
                const endDate = getProjectEnd(p);

                e.dataTransfer.setData('projectId', p.id);
                e.dataTransfer.setData('sourcePMId', '0');
                e.dataTransfer.setData('timelineStartDate', startDate || '');
                e.dataTransfer.setData('timelineEndDate', endDate || '');
                e.dataTransfer.setData(
                  'timelineDurationDays',
                  String(diffDaysUTC(startDate || new Date(), endDate || startDate || new Date()))
                );
              }}
              onClick={() => onProjectClick(p)}
              className="premium-unassigned-card"
            >
              <div className="premium-unassigned-card__title">{p.project_name}</div>
              
              <div className="premium-unassigned-card__meta">
                 <div className="premium-unassigned-card__row">
                   <span className="premium-unassigned-card__label">Dispatch</span>
                   <span style={{ color: 'var(--tx)', fontWeight: 600 }}>{p.dispatch_date || p.allocation_start_date}</span>
                 </div>
                 
                 <div className="premium-unassigned-card__row">
                   <span className="premium-unassigned-card__label">Event</span>
                   <span style={{ color: 'var(--tx)', fontWeight: 600 }}>{p.event_start_date || 'N/A'} - {p.event_end_date || 'N/A'}</span>
                 </div>

                 <div className="premium-unassigned-card__row" style={{ color: 'var(--tx3)', fontWeight: 500 }}>
                   <span className="premium-unassigned-card__label">Location</span>
                   {p.venue || p.branch || 'Loc: N/A'}
                 </div>
              </div>
              <div style={{ position: 'absolute', top: '14px', right: '14px', color: 'var(--tx3)' }}><Grab size={14} /></div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
