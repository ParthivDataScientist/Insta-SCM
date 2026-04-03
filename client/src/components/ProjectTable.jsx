import React, { useState, useEffect } from 'react';
import { Edit3, User } from 'lucide-react';
import CalendarPicker from './CalendarPicker';
import { formatDateDisplay, parseDateInput } from '../utils/dateUtils';
import ManagerAvailabilityModal from './ManagerAvailabilityModal';
import { getProjectCode } from '../utils/projectStatus';

const DATE_PLACEHOLDER = '-';

const DateCell = ({ project, field, editingCell, setEditingCell, updateProjectFull }) => {
    const isEditing = editingCell?.id === project.id && editingCell?.field === field;
    const value = project[field] || '';
    const displayValue = formatDateDisplay(value) || DATE_PLACEHOLDER;
    const [rect, setRect] = useState(null);
    const [inputValue, setInputValue] = useState('');

    useEffect(() => {
        if (isEditing) {
            setInputValue(formatDateDisplay(value));
        }
    }, [isEditing, value]);

    const handleDateChange = async (projectId, targetField, isoValue) => {
        if (updateProjectFull && isoValue) {
            await updateProjectFull(projectId, { [targetField]: isoValue });
        }
        setEditingCell(null);
    };

    const handleManualSubmit = (event) => {
        if (event.key === 'Enter') {
            const iso = parseDateInput(inputValue);
            if (iso) {
                handleDateChange(project.id, field, iso);
            } else {
                alert('Invalid format. Please use DD-MM-YYYY');
            }
        }
    };

    return (
        <td
            onClick={(event) => {
                event.stopPropagation();
                if (isEditing) return;
                const cellRect = event.currentTarget.getBoundingClientRect();
                setRect(cellRect);
                setEditingCell({ id: project.id, field });
            }}
            className="hover-edit project-date-cell"
            style={{ cursor: 'pointer', position: 'relative' }}
        >
            <div className="project-date-cell__content">
                {isEditing ? (
                    <input
                        autoFocus
                        className="inline-date-input"
                        value={inputValue}
                        onChange={(event) => setInputValue(event.target.value)}
                        onKeyDown={handleManualSubmit}
                        onBlur={(event) => {
                            const iso = parseDateInput(event.target.value);
                            if (iso && iso !== value) handleDateChange(project.id, field, iso);
                        }}
                        placeholder="DD-MM-YYYY"
                    />
                ) : (
                    <>
                        <span title={displayValue}>{displayValue}</span>
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
    const [editingCell, setEditingCell] = useState(null);
    const [viewingManager, setViewingManager] = useState(null);

    return (
        <>
            <table className="tracking-table tracking-table--projects">
                <thead>
                    <tr>
                        <th>Project ID</th>
                        <th>Project Name</th>
                        <th>Stage</th>
                        <th>Event Name</th>
                        <th>Venue</th>
                        <th>Area</th>
                        <th>Manager</th>
                        <th className="project-date-heading">Event Start</th>
                        <th className="project-date-heading">Dispatch</th>
                        <th className="project-date-heading">Install Start</th>
                        <th className="project-date-heading">Install End</th>
                        <th className="project-date-heading">Event End</th>
                        <th className="project-date-heading">Dismantle</th>
                        <th>Branch</th>
                    </tr>
                </thead>
                <tbody>
                    {projects.map((project) => (
                        <tr
                            key={project.id}
                            className={`table-row ${selectedProject?.id === project.id ? 'selected-row' : ''}`}
                            onClick={() => onSelectProject && onSelectProject(selectedProject?.id === project.id ? null : project)}
                            onDoubleClick={() => onDoubleClickProject && onDoubleClickProject(project)}
                            style={{ cursor: 'pointer', userSelect: 'none' }}
                        >
                            <td className="fw-600">{getProjectCode(project)}</td>
                            <td className="fw-600">{project.project_name || DATE_PLACEHOLDER}</td>
                            <td>
                                <span className={`status-badge ${(project.board_stage || 'TBC') === 'TBC' ? 'in-transit' : 'delivered'}`}>
                                    {project.board_stage || 'TBC'}
                                </span>
                            </td>
                            <td>{project.event_name || DATE_PLACEHOLDER}</td>
                            <td>{project.venue || DATE_PLACEHOLDER}</td>
                            <td>{project.area || DATE_PLACEHOLDER}</td>
                            <td
                                onClick={(event) => {
                                    if (project.manager_id && project.project_manager) {
                                        event.stopPropagation();
                                        setViewingManager({ id: project.manager_id, name: project.project_manager });
                                    }
                                }}
                                className="pm-clickable"
                                style={{
                                    cursor: project.project_manager ? 'pointer' : 'default',
                                    fontWeight: 500,
                                    color: project.project_manager ? 'var(--red)' : 'var(--tx2)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <User size={12} />
                                {project.project_manager || DATE_PLACEHOLDER}
                            </td>
                            <DateCell project={project} field="event_start_date" editingCell={editingCell} setEditingCell={setEditingCell} updateProjectFull={updateProjectFull} />
                            <DateCell project={project} field="dispatch_date" editingCell={editingCell} setEditingCell={setEditingCell} updateProjectFull={updateProjectFull} />
                            <DateCell project={project} field="installation_start_date" editingCell={editingCell} setEditingCell={setEditingCell} updateProjectFull={updateProjectFull} />
                            <DateCell project={project} field="installation_end_date" editingCell={editingCell} setEditingCell={setEditingCell} updateProjectFull={updateProjectFull} />
                            <DateCell project={project} field="event_end_date" editingCell={editingCell} setEditingCell={setEditingCell} updateProjectFull={updateProjectFull} />
                            <DateCell project={project} field="dismantling_date" editingCell={editingCell} setEditingCell={setEditingCell} updateProjectFull={updateProjectFull} />
                            <td>{project.branch || DATE_PLACEHOLDER}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {viewingManager && (
                <ManagerAvailabilityModal
                    managerId={viewingManager.id}
                    managerName={viewingManager.name}
                    onClose={() => setViewingManager(null)}
                />
            )}
        </>
    );
}
