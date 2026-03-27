import React from 'react';

// Format helper
const formatDate = (dateStr) => {
    if (!dateStr || dateStr === 'TBD' || dateStr === '—') return dateStr;
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric'
        });
    } catch (e) {
        return dateStr;
    }
};

export default function ProjectTable({ projects, loading, selectedProject, onSelectProject, onDoubleClickProject }) {
    if (projects.length === 0 && !loading) {
        return <div className="empty-row">No projects found.</div>;
    }

    return (
        <table className="tracking-table">
            <thead>
                <tr>
                    <th>Project Name</th>
                    <th>Stage</th>
                    <th>Event Name</th>
                    <th>Venue</th>
                    <th>Area</th>
                    <th>Event Start</th>
                    <th>Material Dispatch</th>
                    <th>Installation Start</th>
                    <th>Installation End</th>
                    <th>Dismantling Date</th>
                    <th>Manager</th>
                    <th>Team Type</th>
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
                        <td>{formatDate(p.event_start_date) || '—'}</td>
                        <td>{formatDate(p.material_dispatch_date) || '—'}</td>
                        <td>{formatDate(p.installation_start_date) || '—'}</td>
                        <td>{formatDate(p.installation_end_date) || '—'}</td>
                        <td>{formatDate(p.dismantling_date) || '—'}</td>
                        <td>{p.project_manager || '—'}</td>
                        <td>{p.team_type || '—'}</td>
                        <td>{p.branch || '—'}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
