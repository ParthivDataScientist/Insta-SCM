import React from 'react';
import { CheckCircle2, ChevronDown, RefreshCw } from 'lucide-react';
import { DESIGN_STATUSES, getProjectCode, normalizeProjectStage } from '../utils/projectStatus';

const STATUS_STYLES = {
    'In-Process': { background: 'var(--o-bg)', color: 'var(--org)', border: '1px solid var(--o-bd)' },
    'Design Change': { background: 'var(--b-bg)', color: 'var(--blu)', border: '1px solid var(--b-bd)' },
    Drop: { background: 'var(--red-ghost)', color: 'var(--red)', border: '1px solid var(--red-glow)' },
    Win: { background: 'var(--green-ghost)', color: 'var(--green)', border: '1px solid var(--green-glow, rgba(16,185,129,0.18))' },
};

export default function DesignTable({ projects, onUpdateStatus }) {
    return (
        <table className="tracking-table tracking-table--projects">
            <thead>
                <tr>
                    <th>Project ID</th>
                    <th>Project Status</th>
                    <th>Project Name</th>
                    <th>Venue</th>
                    <th>Area</th>
                    <th>Event Date</th>
                </tr>
            </thead>
            <tbody>
                {projects.map((project) => {
                    const status = normalizeProjectStage(project.stage);
                    const statusStyle = STATUS_STYLES[status] || STATUS_STYLES['In-Process'];

                    return (
                        <tr key={project.id} className="table-row" style={{ cursor: 'default' }}>
                            <td className="fw-600">{getProjectCode(project)}</td>
                            <td>
                                <div
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '6px 10px',
                                        borderRadius: '999px',
                                        ...statusStyle,
                                    }}
                                >
                                    {status === 'Win' ? <CheckCircle2 size={12} /> : <RefreshCw size={12} />}
                                    <select
                                        value={status}
                                        onChange={(event) => onUpdateStatus(project.id, { stage: event.target.value })}
                                        style={{
                                            border: 'none',
                                            background: 'transparent',
                                            color: 'inherit',
                                            font: 'inherit',
                                            fontSize: '11px',
                                            fontWeight: 800,
                                            textTransform: 'uppercase',
                                            outline: 'none',
                                            cursor: 'pointer',
                                            appearance: 'none',
                                            WebkitAppearance: 'none',
                                            paddingRight: '16px',
                                        }}
                                    >
                                        {DESIGN_STATUSES.map((option) => (
                                            <option key={option} value={option}>{option}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={12} style={{ pointerEvents: 'none', marginLeft: '-14px' }} />
                                </div>
                            </td>
                            <td>{project.project_name || '-'}</td>
                            <td>{project.venue || '-'}</td>
                            <td>{project.area || '-'}</td>
                            <td>{project.event_start_date || '-'}</td>
                        </tr>
                    );
                })}

                {projects.length === 0 && (
                    <tr>
                        <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: 'var(--tx3)', fontWeight: 600 }}>
                            No design briefs match the current filters.
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
    );
}
