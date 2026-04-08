import React from 'react';
import { CheckCircle2, ChevronDown, Clock3, PencilRuler, RefreshCw, XCircle } from 'lucide-react';
import { getProjectCode } from '../utils/projectStatus';

const STATUS_META = {
    pending: {
        label: 'Pending',
        icon: Clock3,
        style: { background: 'var(--bg-in)', color: 'var(--tx2)', border: '1px solid var(--bd)' },
    },
    in_progress: {
        label: 'In Progress',
        icon: PencilRuler,
        style: { background: 'var(--b-bg)', color: 'var(--blu)', border: '1px solid var(--b-bd)' },
    },
    changes: {
        label: 'Changes',
        icon: RefreshCw,
        style: { background: 'var(--o-bg)', color: 'var(--org)', border: '1px solid var(--o-bd)' },
    },
    won: {
        label: 'Won',
        icon: CheckCircle2,
        style: { background: 'var(--green-ghost)', color: 'var(--green)', border: '1px solid var(--green-glow)' },
    },
    lost: {
        label: 'Lost',
        icon: XCircle,
        style: { background: 'var(--red-ghost)', color: 'var(--red)', border: '1px solid var(--red-glow)' },
    },
};

const STATUS_OPTIONS = ['pending', 'in_progress', 'changes', 'won', 'lost'];

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
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onBlur={commitValue}
            onKeyDown={(event) => {
                if (event.key === 'Enter') {
                    event.currentTarget.blur();
                }
            }}
            placeholder="v1 / Final / Custom"
            className="premium-inline-select"
            style={{ minWidth: '140px' }}
        />
    );
}

export default function DesignTable({ projects, onUpdateStatus, onUpdateField = onUpdateStatus }) {
    return (
        <table className="tracking-table tracking-table--projects">
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
                    const toneClass = project.status === 'won'
                        ? 'status-dot--green'
                        : project.status === 'lost'
                            ? 'status-dot--red'
                            : project.status === 'changes'
                                ? 'status-dot--amber'
                                : project.status === 'in_progress'
                                    ? 'status-dot--blue'
                                    : 'status-dot--neutral';

                    return (
                        <tr key={project.id} className="table-row" style={{ cursor: 'default' }}>
                            <td className="fw-600">{getProjectCode(project)}</td>
                            <td>
                                <div className={`status-select-inline status-dot ${toneClass}`}>
                                    <select
                                        className="status-select-inline__control"
                                        value={project.status}
                                        onChange={(event) => onUpdateStatus(project.id, { status: event.target.value })}
                                    >
                                        {STATUS_OPTIONS.map((option) => (
                                            <option key={option} value={option}>{STATUS_META[option].label}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={12} className="status-select-inline__caret" />
                                </div>
                            </td>
                            <td>{project.project_name || '-'}</td>
                            <td>{project.client || '-'}</td>
                            <td>{project.city || '-'}</td>
                            <td>
                                <VersionCell project={project} onUpdateField={onUpdateField} />
                            </td>
                            <td>{project.booking_date || '—'}</td>
                            <td>{project.event_start_date || '—'}</td>
                        </tr>
                    );
                })}

                {projects.length === 0 && (
                    <tr>
                        <td colSpan="8" style={{ padding: '32px', textAlign: 'center', color: 'var(--tx3)', fontWeight: 600 }}>
                            No design briefs match the current filters.
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
    );
}
