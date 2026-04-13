import React from 'react';
import { CheckCircle2, ChevronDown, Clock3, PencilRuler, RefreshCw, XCircle } from 'lucide-react';
import { formatDateDisplay } from '../utils/dateUtils';

const STATUS_META = {
    pending: {
        label: 'Pending',
        icon: Clock3,
        pillClass: 'design-table__status-pill--pending',
    },
    in_progress: {
        label: 'In Progress',
        icon: PencilRuler,
        pillClass: 'design-table__status-pill--in-progress',
    },
    changes: {
        label: 'Changes',
        icon: RefreshCw,
        pillClass: 'design-table__status-pill--changes',
    },
    won: {
        label: 'Won',
        icon: CheckCircle2,
        pillClass: 'design-table__status-pill--won',
    },
    lost: {
        label: 'Lost',
        icon: XCircle,
        pillClass: 'design-table__status-pill--lost',
    },
};

const STATUS_OPTIONS = ['pending', 'in_progress', 'changes', 'won', 'lost'];

function getDesignBriefId(project) {
    if (project?.crm_project_id) {
        return project.crm_project_id;
    }
    return `Proj - ${project?.id ?? '-'}`;
}

function VersionCell({ project, onUpdateField }) {
    const [value, setValue] = React.useState(project.current_version || '');

    React.useEffect(() => {
        setValue(project.current_version || '');
    }, [project.current_version, project.id]);

    const commitValue = () => {
        const nextValue = value.trim();
        const currentValue = (project.current_version || '').trim();
        if (nextValue === currentValue) {
            return;
        }

        onUpdateField(project.id, { current_version: nextValue || null });
    };

    return (
        <input
            type="text"
            className="design-table__version-input"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onBlur={commitValue}
            onKeyDown={(event) => {
                if (event.key === 'Enter') {
                    event.currentTarget.blur();
                }
            }}
            placeholder="Version"
        />
    );
}

export default function DesignTable({ projects, onUpdateStatus, onUpdateField = onUpdateStatus, onOpenProject = null }) {
    return (
        <table className="design-table">
            <thead>
                <tr>
                    <th className="design-table__th design-table__th--left">Brief ID</th>
                    <th className="design-table__th design-table__th--center">Status</th>
                    <th className="design-table__th design-table__th--left">Project Name</th>
                    <th className="design-table__th design-table__th--left design-table__th--client">Client</th>
                    <th className="design-table__th design-table__th--left design-table__th--city">City</th>
                    <th className="design-table__th design-table__th--right">Version</th>
                    <th className="design-table__th design-table__th--right">Booking Date</th>
                    <th className="design-table__th design-table__th--right">Show Date</th>
                </tr>
            </thead>
            <tbody>
                {projects.map((project) => {
                    const meta = STATUS_META[project.status] || STATUS_META.pending;
                    const Icon = meta.icon;

                    return (
                        <tr
                            key={project.id}
                            className={`design-table__row${onOpenProject ? ' design-table__row--clickable' : ''}`}
                            onDoubleClick={() => onOpenProject?.(project)}
                        >
                            <td className="design-table__td design-table__brief-id">{getDesignBriefId(project)}</td>
                            <td className="design-table__td design-table__td--status">
                                <div className={`design-table__status-pill ${meta.pillClass}`}>
                                    <Icon size={12} />
                                    <select
                                        value={project.status}
                                        onChange={(event) => onUpdateStatus(project.id, { status: event.target.value })}
                                        className="design-table__status-select"
                                    >
                                        {STATUS_OPTIONS.map((option) => (
                                            <option key={option} value={option}>{STATUS_META[option].label}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={12} className="design-table__status-chevron" />
                                </div>
                            </td>
                            <td className="design-table__td design-table__project-name">
                                {onOpenProject ? (
                                    <button
                                        type="button"
                                        className="design-table__project-link"
                                        onClick={() => onOpenProject(project)}
                                    >
                                        {project.project_name || '-'}
                                    </button>
                                ) : (
                                    project.project_name || '-'
                                )}
                            </td>
                            <td className="design-table__td design-table__td--client">{project.client || 'Client pending'}</td>
                            <td className="design-table__td design-table__td--city">{project.city || 'City pending'}</td>
                            <td className="design-table__td design-table__td--right design-table__td--version">
                                <VersionCell project={project} onUpdateField={onUpdateField} />
                            </td>
                            <td className="design-table__td design-table__td--right design-table__td--tabular">
                                {formatDateDisplay(project.booking_date) || '-'}
                            </td>
                            <td className="design-table__td design-table__td--right design-table__td--tabular">
                                {formatDateDisplay(project.event_start_date) || '-'}
                            </td>
                        </tr>
                    );
                })}

                {projects.length === 0 && (
                    <tr>
                        <td colSpan="8" className="design-table__empty">
                            No design briefs match the current filters.
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
    );
}
