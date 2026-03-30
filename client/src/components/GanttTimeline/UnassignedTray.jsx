import React, { useState } from 'react';
import { Briefcase, Calendar, Grab, X } from 'lucide-react';

/**
 * UnassignedTray Component
 * A sidebar that holds projects currently without managers.
 */
export default function UnassignedTray({ projects, onProjectClick, onDropReassign }) {
  const [isOver, setIsOver] = useState(false);

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
      className="unassigned-tray"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        width: '320px', flexShrink: 0, borderLeft: '1px solid var(--bd)',
        background: isOver ? 'var(--red-ghost)' : 'var(--bg-card)', 
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', height: '100%', zIndex: 100,
        transition: 'background 0.2s ease'
      }}
    >
      <div style={{ padding: '20px', borderBottom: '1px solid var(--bd)', background: 'var(--bg-ralt)' }}>
        <h3 style={{ fontSize: '12px', fontWeight: 900, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          <Briefcase size={16} /> UNASSIGNED POOL ({projects?.length || 0})
        </h3>
        <p style={{ fontSize: '11px', color: 'var(--tx3)', marginTop: '4px', fontWeight: 600 }}>Drag here to unassign from a manager.</p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }} className="no-scrollbar">
        {!projects || projects.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--tx3)', fontSize: '12px', fontWeight: 600, border: '2px dashed var(--bd)', borderRadius: 'var(--r-md)' }}>
            No unassigned projects.
          </div>
        ) : (
          projects.map((p) => (
            <div 
              key={p.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('projectId', p.id);
                e.dataTransfer.setData('sourcePM', 'Unassigned');
              }}
              onClick={() => onProjectClick(p)}
              style={{
                padding: '16px', border: '1.5px solid var(--bd)', borderRadius: 'var(--r-md)',
                background: 'var(--bg-card)', marginBottom: '16px', cursor: 'grab',
                transition: 'all 0.2s ease', position: 'relative',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
              }}
              className="hover-card"
            >
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--tx)', marginBottom: '10px', borderBottom: '1px solid var(--bd-l)', pb: '4px' }}>{p.project_name}</div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '10px' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                   <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--red)' }} />
                   <span style={{ color: 'var(--tx3)', textTransform: 'uppercase', fontWeight: 800 }}>Dispatch:</span>
                   <span style={{ color: 'var(--tx)', fontWeight: 700 }}>{p.material_dispatch_date}</span>
                 </div>
                 
                 <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                   <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--blu)' }} />
                   <span style={{ color: 'var(--blu)', textTransform: 'uppercase', fontWeight: 800 }}>Show Dates:</span>
                   <span style={{ color: 'var(--tx)', fontWeight: 700 }}>{p.event_start_date || 'N/A'} — {p.event_end_date || 'N/A'}</span>
                 </div>

                 <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--tx3)', fontWeight: 600 }}>
                   <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--bd)' }} />
                   {p.venue || p.branch || 'Loc: N/A'}
                 </div>
              </div>
              <div style={{ position: 'absolute', top: '16px', right: '16px', color: 'var(--bd)' }}><Grab size={16} /></div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
