import React, { useState } from 'react';
import { ChevronDown, User } from 'lucide-react';
import ManagerAvailabilityModal from './ManagerAvailabilityModal';
import { EXECUTION_BOARD_STAGES, getProjectCode, normalizeBoardStage } from '../utils/projectStatus';
import EmptyState from './EmptyState';
import { formatDateDisplay } from '../utils/dateUtils';

const DATE_PLACEHOLDER = '-';
const BOARD_STAGE_META = {
    'Design/ BOM': 'design-table__status-pill--changes',
    'Procuement (Material management)': 'design-table__status-pill--pending',
    Production: 'design-table__status-pill--in-progress',
    QC: 'design-table__status-pill--pending',
    Dispatch: 'design-table__status-pill--in-progress',
    'Event Installation': 'design-table__status-pill--won',
    Dismantle: 'design-table__status-pill--changes',
    Inventory: 'design-table__status-pill--pending',
};

function StageSelect({ stage, onChange }) {
    const normalizedStage = normalizeBoardStage(stage);
    const pillClass = BOARD_STAGE_META[normalizedStage] || 'design-table__status-pill--pending';

    return (
        <div className={`design-table__status-pill ${pillClass}`}>
            <select
                className="design-table__status-select design-table__status-select--board"
                value={normalizedStage}
                onChange={(event) => onChange(event.target.value)}
                onClick={(event) => event.stopPropagation()}
            >
                {EXECUTION_BOARD_STAGES.map((option) => (
                    <option key={option} value={option}>
                        {option}
                    </option>
                ))}
            </select>
            <ChevronDown size={12} className="design-table__status-chevron" />
        </div>
    );
}

export default function ProjectTable({
    projects,
    loading,
    selectedProject,
    onSelectProject,
    onDoubleClickProject,
    onUpdateStage,
}) {
    const [viewingManager, setViewingManager] = useState(null);

    if (projects.length === 0 && !loading) {
        return (
            <div className="design-dashboard__table-empty">
                <EmptyState
                    title="No projects available"
                    description="Try clearing filters or widen the date range to bring more execution work into view."
                />
            </div>
        );
    }

    return (
        <>
            <table className="design-table design-table--projects">
                    <thead>
                        <tr>
                            <th className="design-table__th design-table__th--left design-table__th--project-id">Project ID</th>
                            <th className="design-table__th design-table__th--left">Project Name</th>
                            <th className="design-table__th design-table__th--center">Stage</th>
                            <th className="design-table__th design-table__th--left">Venue</th>
                            <th className="design-table__th design-table__th--left">Area</th>
                            <th className="design-table__th design-table__th--left">Manager</th>
                            <th className="design-table__th design-table__th--right">Event Start</th>
                            <th className="design-table__th design-table__th--right">Dispatch</th>
                            <th className="design-table__th design-table__th--right">Install Start</th>
                            <th className="design-table__th design-table__th--right">Install End</th>
                            <th className="design-table__th design-table__th--right">Event End</th>
                            <th className="design-table__th design-table__th--right">Dismantle</th>
                            <th className="design-table__th design-table__th--left">Branch</th>
                        </tr>
                    </thead>
                    <tbody>
                        {projects.map((project) => {
                            const isSelected = selectedProject?.id === project.id;
                            const managerName = project.project_manager || 'Unassigned';

                            return (
                                <tr
                                    key={project.id}
                                    className={`design-table__row design-table__row--clickable${isSelected ? ' design-table__row--selected' : ''}`}
                                    onClick={() => onSelectProject?.(isSelected ? null : project)}
                                    onDoubleClick={() => onDoubleClickProject?.(project)}
                                >
                                    <td className="design-table__td design-table__brief-id">{getProjectCode(project)}</td>
                                    <td className="design-table__td design-table__project-name">
                                        {project.project_name || DATE_PLACEHOLDER}
                                    </td>
                                    <td className="design-table__td design-table__td--status">
                                        <StageSelect
                                            stage={project.board_stage}
                                            onChange={(nextStage) => onUpdateStage?.(project.id, nextStage)}
                                        />
                                    </td>
                                    <td className="design-table__td">{project.venue || DATE_PLACEHOLDER}</td>
                                    <td className="design-table__td">{project.area || DATE_PLACEHOLDER}</td>
                                    <td className="design-table__td design-table__td--manager">
                                        {project.manager_id && project.project_manager ? (
                                            <button
                                                type="button"
                                                className="design-table__manager-button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    setViewingManager({ id: project.manager_id, name: project.project_manager });
                                                }}
                                            >
                                                <span className="design-table__manager-display">
                                                    <User size={13} />
                                                    <span>{managerName}</span>
                                                </span>
                                            </button>
                                        ) : (
                                            <span className="design-table__manager-display design-table__manager-display--unassigned">
                                                <User size={13} />
                                                <span>{managerName}</span>
                                            </span>
                                        )}
                                    </td>
                                    <td className="design-table__td design-table__td--right design-table__td--tabular design-table__td--nowrap">
                                        {formatDateDisplay(project.event_start_date) || DATE_PLACEHOLDER}
                                    </td>
                                    <td className="design-table__td design-table__td--right design-table__td--tabular design-table__td--nowrap">
                                        {formatDateDisplay(project.dispatch_date) || DATE_PLACEHOLDER}
                                    </td>
                                    <td className="design-table__td design-table__td--right design-table__td--tabular design-table__td--nowrap">
                                        {formatDateDisplay(project.installation_start_date) || DATE_PLACEHOLDER}
                                    </td>
                                    <td className="design-table__td design-table__td--right design-table__td--tabular design-table__td--nowrap">
                                        {formatDateDisplay(project.installation_end_date) || DATE_PLACEHOLDER}
                                    </td>
                                    <td className="design-table__td design-table__td--right design-table__td--tabular design-table__td--nowrap">
                                        {formatDateDisplay(project.event_end_date) || DATE_PLACEHOLDER}
                                    </td>
                                    <td className="design-table__td design-table__td--right design-table__td--tabular design-table__td--nowrap">
                                        {formatDateDisplay(project.dismantling_date) || DATE_PLACEHOLDER}
                                    </td>
                                    <td className="design-table__td">{project.branch || DATE_PLACEHOLDER}</td>
                                </tr>
                            );
                        })}
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
