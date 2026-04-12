import React from 'react';
import { CheckCircle2, ChevronDown, Clock3, PencilRuler, RefreshCw, XCircle } from 'lucide-react';
import { formatDateDisplay } from '../utils/dateUtils';

const STATUS_META = {
    pending: {
        label: 'Pending',
        icon: Clock3,
        style: { background: 'var(--status-pending-bg)', color: 'var(--warning)', border: '1px solid color-mix(in srgb, var(--warning) 24%, transparent)' },
    },
    in_progress: {
        label: 'In Progress',
        icon: PencilRuler,
        style: { background: 'var(--status-progress-bg)', color: 'var(--status-progress-text)', border: '1px solid color-mix(in srgb, var(--status-progress-text) 24%, transparent)' },
    },
    changes: {
        label: 'Changes',
        icon: RefreshCw,
        style: { background: 'var(--status-changes-bg)', color: 'var(--status-changes-text)', border: '1px solid color-mix(in srgb, var(--status-changes-text) 24%, transparent)' },
    },
    won: {
        label: 'Won',
        icon: CheckCircle2,
        style: { background: 'var(--status-won-bg)', color: 'var(--status-won-text)', border: '1px solid color-mix(in srgb, var(--status-won-text) 24%, transparent)' },
    },
    lost: {
        label: 'Lost',
        icon: XCircle,
        style: { background: 'var(--status-lost-bg)', color: 'var(--status-lost-text)', border: '1px solid color-mix(in srgb, var(--status-lost-text) 24%, transparent)' },
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
                    <th>Brief ID</th>
                    <th>Status</th>
                    <th>Project Name</th>
                    <th>Client</th>
                    <th>City</th>
                    <th>Version</th>
                    <th>Booking Date</th>
                    <th>Show Date</th>
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
                            <td className="design-table__brief-id">{getDesignBriefId(project)}</td>
                            <td>
                                <div className="design-table__status-pill" style={meta.style}>
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
                            <td className="design-table__project-name">
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
                            <td>{project.client || 'Client pending'}</td>
                            <td>{project.city || 'City pending'}</td>
                            <td>
                                <VersionCell project={project} onUpdateField={onUpdateField} />
                            </td>
                            <td>{formatDateDisplay(project.booking_date) || '-'}</td>
                            <td>{formatDateDisplay(project.event_start_date) || '-'}</td>
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
