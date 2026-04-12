import React, { useState } from 'react';
import { User } from 'lucide-react';
import ManagerAvailabilityModal from './ManagerAvailabilityModal';
import { getProjectCode, normalizeBoardStage } from '../utils/projectStatus';
import EmptyState from './EmptyState';
import { formatDateDisplay } from '../utils/dateUtils';

const DATE_PLACEHOLDER = '-';

function StagePill({ stage }) {
    const s = normalizeBoardStage(stage);
    const sLower = s.toLowerCase();
    let bg = 'var(--bg-card)';
    let color = 'var(--text-primary)';
    let border = 'var(--border)';

    if (sLower.includes('design') || sLower.includes('bom')) {
        color = '#D97706'; // orange-600
        bg = 'color-mix(in srgb, #D97706 15%, transparent)';
        border = 'color-mix(in srgb, #D97706 30%, transparent)';
    } else if (sLower.includes('production')) {
        color = '#2563EB'; // blue-600
        bg = 'color-mix(in srgb, #2563EB 15%, transparent)';
        border = 'color-mix(in srgb, #2563EB 30%, transparent)';
    } else if (sLower.includes('qc') || sLower.includes('dispatch')) {
        color = '#9333EA'; // purple-600
        bg = 'color-mix(in srgb, #9333EA 15%, transparent)';
        border = 'color-mix(in srgb, #9333EA 30%, transparent)';
    } else if (sLower.includes('install')) {
        color = '#059669'; // green-600
        bg = 'color-mix(in srgb, #059669 15%, transparent)';
        border = 'color-mix(in srgb, #059669 30%, transparent)';
    }

    return (
        <div style={{
            background: bg,
            color: color,
            border: `1px solid ${border}`,
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: '600',
            display: 'inline-block',
            whiteSpace: 'nowrap',
            textAlign: 'center'
        }}>
            {s}
        </div>
    );
}

export default function ProjectTable({
    projects,
    loading,
    selectedProject,
    onSelectProject,
    onDoubleClickProject,
}) {
    const [viewingManager, setViewingManager] = useState(null);

    return (
        <>
            {projects.length === 0 && !loading ? (
                <div className="saas-panel-content">
                    <EmptyState
                        title="No projects available"
                        description="Try clearing filters or widen the date range to bring more execution work into view."
                    />
                </div>
            ) : (
                <div style={{ paddingBottom: '16px' }}>
                <table className="design-table" style={{ width: '100%', fontSize: '13px' }}>
                    <thead>
                        <tr>
                            <th style={{ whiteSpace: 'nowrap' }}>PROJECT ID</th>
                            <th style={{ whiteSpace: 'nowrap' }}>PROJECT NAME</th>
                            <th style={{ whiteSpace: 'nowrap' }}>STAGE</th>
                            <th style={{ whiteSpace: 'nowrap' }}>EVENT NAME</th>
                            <th style={{ whiteSpace: 'nowrap' }}>VENUE</th>
                            <th style={{ whiteSpace: 'nowrap' }}>AREA</th>
                            <th style={{ whiteSpace: 'nowrap' }}>MANAGER</th>
                            <th style={{ whiteSpace: 'nowrap' }}>EVENT START</th>
                            <th style={{ whiteSpace: 'nowrap' }}>DISPATCH</th>
                            <th style={{ whiteSpace: 'nowrap' }}>INSTALL START</th>
                            <th style={{ whiteSpace: 'nowrap' }}>INSTALL END</th>
                            <th style={{ whiteSpace: 'nowrap' }}>EVENT END</th>
                            <th style={{ whiteSpace: 'nowrap' }}>DISMANTLE</th>
                            <th style={{ whiteSpace: 'nowrap' }}>BRANCH</th>
                        </tr>
                    </thead>
                    <tbody>
                        {projects.map((project) => {
                            return (
                                <tr
                                    key={project.id}
                                    className={`design-table__row${selectedProject?.id === project.id ? ' design-table__row--clickable' : ''}`}
                                    onClick={() => onSelectProject && onSelectProject(selectedProject?.id === project.id ? null : project)}
                                    onDoubleClick={() => onDoubleClickProject && onDoubleClickProject(project)}
                                    style={{ cursor: 'pointer', userSelect: 'none' }}
                                >
                                    <td style={{ fontWeight: '600', fontSize: '13px' }}>{getProjectCode(project)}</td>
                                    <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{project.project_name || DATE_PLACEHOLDER}</td>
                                    <td>
                                        <StagePill stage={project.board_stage} />
                                    </td>
                                    <td style={{ color: 'var(--text-primary)' }}>{project.event_name || project.client || DATE_PLACEHOLDER}</td>
                                    <td style={{ color: 'var(--text-primary)' }}>{project.venue || DATE_PLACEHOLDER}</td>
                                    <td style={{ color: 'var(--text-primary)' }}>{project.area || DATE_PLACEHOLDER}</td>
                                    <td
                                        onClick={(event) => {
                                            if (project.manager_id && project.project_manager) {
                                                event.stopPropagation();
                                                setViewingManager({ id: project.manager_id, name: project.project_manager });
                                            }
                                        }}
                                        style={{ whiteSpace: 'nowrap' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                                            <User size={13} />
                                            <span>{project.project_manager || 'Unassigned'}</span>
                                        </div>
                                    </td>
                                    <td style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{formatDateDisplay(project.event_start_date) || DATE_PLACEHOLDER}</td>
                                    <td style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{formatDateDisplay(project.dispatch_date) || DATE_PLACEHOLDER}</td>
                                    <td style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{formatDateDisplay(project.installation_start_date) || DATE_PLACEHOLDER}</td>
                                    <td style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{formatDateDisplay(project.installation_end_date) || DATE_PLACEHOLDER}</td>
                                    <td style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{formatDateDisplay(project.event_end_date) || DATE_PLACEHOLDER}</td>
                                    <td style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{formatDateDisplay(project.dismantle_date) || DATE_PLACEHOLDER}</td>
                                    <td style={{ color: 'var(--text-primary)' }}>{project.branch || DATE_PLACEHOLDER}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                </div>
            )}

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
