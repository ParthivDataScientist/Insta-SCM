import React, { useState, useEffect } from 'react';
import { Edit3, Calendar } from 'lucide-react';
import CalendarPicker from './CalendarPicker';
import { formatDateDisplay, parseDateInput, isValidDisplayDate } from '../utils/dateUtils';
import ManagerAvailabilityModal from './ManagerAvailabilityModal';
import { User } from 'lucide-react';

const DateCell = ({ project, field, editingCell, setEditingCell, updateProjectFull }) => {
    const isEditing = editingCell?.id === project.id && editingCell?.field === field;
    const value = project[field] || ''; // This is ISO (YYYY-MM-DD)
    const [rect, setRect] = useState(null);
    const [inputValue, setInputValue] = useState('');

    useEffect(() => {
        if (isEditing) {
            setInputValue(formatDateDisplay(value));
        }
    }, [isEditing, value]);

    const handleDateChange = async (projectId, field, isoValue) => {
        if (updateProjectFull && isoValue) {
            await updateProjectFull(projectId, { [field]: isoValue });
        }
        setEditingCell(null);
    };

    const handleManualSubmit = (e) => {
        if (e.key === 'Enter') {
            const iso = parseDateInput(inputValue);
            if (iso) {
                handleDateChange(project.id, field, iso);
            } else {
                // Invalid format feedback
                alert('Invalid format. Please use DD-MM-YYYY');
            }
        }
    };

    return (
        <td 
            onClick={(e) => { 
                e.stopPropagation(); 
                if (isEditing) return;
                const cellRect = e.currentTarget.getBoundingClientRect();
                setRect(cellRect);
                setEditingCell({ id: project.id, field }); 
            }}
            className="hover-edit"
            style={{ cursor: 'pointer', position: 'relative' }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {isEditing ? (
                   <input 
                      autoFocus
                      className="inline-date-input"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleManualSubmit}
                      onBlur={(e) => {
                         const iso = parseDateInput(e.target.value);
                         if (iso && iso !== value) handleDateChange(project.id, field, iso);
                         // Don't close immediately if clicking the picker
                      }}
                      placeholder="DD-MM-YYYY"
                   />
                ) : (
                  <>
                    {formatDateDisplay(value) || '—'}
                    <Edit3 size={10} className="edit-icon-hover" style={{ opacity: 0, color: 'var(--org)' }} />
                  </>
                )}
            </div>
            
            {isEditing && rect && (
                <CalendarPicker 
                    initialDate={value}
                    anchorRect={rect}
                    onSelect={(date) => handleDateChange(project.id, field, date)}
                    onClose={() => setEditingCell(null)}
                />
            )}
        </td>
    );
};

export default function ProjectTable({ 
    projects, 
    loading, 
    selectedProject, 
    onSelectProject, 
    onDoubleClickProject,
    updateProjectFull 
}) {
    const [editingCell, setEditingCell] = useState(null); // { id, field }
    const [viewingManager, setViewingManager] = useState(null);

    return (
        <table className="tracking-table">
            <thead>
                <tr>
                    <th>Project Name</th>
                    <th>Stage</th>
                    <th>Event Name</th>
                    <th>Venue</th>
                    <th>Area</th>
                    <th>Manager</th>
                    <th>Event Start</th>
                    <th>Event End</th>
                    <th>Dispatch</th>
                    <th>Install Start</th>
                    <th>Install End</th>
                    <th>Dismantle</th>
                    <th>Branch</th>
                </tr>
            </thead>
            <tbody>
                {projects.map(p => (
                    <tr 
                        key={p.id} 
                        className={`table-row ${selectedProject?.id === p.id ? 'selected-row' : ''}`}
                        onClick={() => onSelectProject && onSelectProject(selectedProject?.id === p.id ? null : p)}
                        onDoubleClick={() => onDoubleClickProject && onDoubleClickProject(p)}
                        style={{ cursor: 'pointer', userSelect: 'none' }}
                    >
                        <td className="fw-600">{p.project_name || '—'}</td>
                        <td>
                            <span className={`status-badge ${p.stage?.toLowerCase() === 'confirmed' ? 'delivered' : 'in-transit'}`}>
                                {p.stage || 'Open'}
                            </span>
                        </td>
                        <td>{p.event_name || '—'}</td>
                        <td>{p.venue || '—'}</td>
                        <td>{p.area || '—'}</td>
                        <td 
                            onClick={(e) => { 
                                if (p.project_manager) {
                                    e.stopPropagation(); 
                                    setViewingManager(p.project_manager); 
                                }
                            }}
                            className="pm-clickable"
                            style={{ 
                                cursor: p.project_manager ? 'pointer' : 'default',
                                fontWeight: 500,
                                color: p.project_manager ? 'var(--red)' : 'var(--tx2)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <User size={12} />
                            {p.project_manager || '—'}
                        </td>
                        <DateCell project={p} field="event_start_date" editingCell={editingCell} setEditingCell={setEditingCell} updateProjectFull={updateProjectFull} />
                        <DateCell project={p} field="event_end_date" editingCell={editingCell} setEditingCell={setEditingCell} updateProjectFull={updateProjectFull} />
                        <DateCell project={p} field="material_dispatch_date" editingCell={editingCell} setEditingCell={setEditingCell} updateProjectFull={updateProjectFull} />
                        <DateCell project={p} field="installation_start_date" editingCell={editingCell} setEditingCell={setEditingCell} updateProjectFull={updateProjectFull} />
                        <DateCell project={p} field="installation_end_date" editingCell={editingCell} setEditingCell={setEditingCell} updateProjectFull={updateProjectFull} />
                        <DateCell project={p} field="dismantling_date" editingCell={editingCell} setEditingCell={setEditingCell} updateProjectFull={updateProjectFull} />
                        <td>{p.branch || '—'}</td>
                    </tr>
                ))}
            </tbody>
            {viewingManager && (
                <ManagerAvailabilityModal 
                    managerName={viewingManager} 
                    onClose={() => setViewingManager(null)} 
                />
            )}
        </table>
    );
}
