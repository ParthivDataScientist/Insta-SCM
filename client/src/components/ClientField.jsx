import React, { useState, useEffect } from 'react';
import { Briefcase, ChevronDown, Loader2 } from 'lucide-react';
import projectsService from '../api/projects';

/**
 * ClientField Component
 * Handles client selection using IDs.
 */
export default function ClientField({ 
    label, 
    field, // Should be client_id
    project, 
    updateProjectFull,
    icon: Icon = Briefcase
}) {
    const [loading, setLoading] = useState(false);
    const [clients, setClients] = useState([]); // [{id, name}, ...]
    
    // The underlying value is the ID
    const currentClientId = project[field];

    const fetchClients = async () => {
        try {
            setLoading(true);
            const data = await projectsService.fetchClients();
            setClients(data);
        } catch (err) {
            console.error("Failed to fetch clients:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClients();
    }, []);

    const handleChange = (e) => {
        const newId = e.target.value ? parseInt(e.target.value, 10) : null;
        if (currentClientId !== newId) {
            updateProjectFull(project.id, { [field]: newId });
        }
    };

    return (
        <div style={{ padding: '16px', border: '1px solid var(--bd)', borderRadius: 'var(--r-md)', background: 'var(--bg-card)' }}>
            <div style={{ fontSize: '11px', color: 'var(--tx3)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
                {loading ? <Loader2 size={14} className="spin" color="var(--tx3)" /> : <Icon size={14} color="var(--tx3)" />}
                <select 
                    value={currentClientId || ''}
                    onChange={handleChange}
                    style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--tx)',
                        outline: 'none',
                        cursor: 'pointer',
                        appearance: 'none',
                        WebkitAppearance: 'none'
                    }}
                >
                    <option value="">No Client</option>
                    {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
                <ChevronDown size={14} color="var(--tx3)" style={{ pointerEvents: 'none' }} />
            </div>
        </div>
    );
}
