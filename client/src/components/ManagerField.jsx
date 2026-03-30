import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, CheckCircle, AlertCircle, Info, Loader2, ChevronDown } from 'lucide-react';
import projectsService from '../api/projects';
import ManagerAvailabilityModal from './ManagerAvailabilityModal';

/**
 * ManagerField Component
 * Handles manager assignment using IDs with smart availability checking.
 */
export default function ManagerField({ 
    label, 
    field, // Should be manager_id
    project, 
    updateProjectFull,
    icon: Icon = User
}) {
    const [managerStatus, setManagerStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [managers, setManagers] = useState([]); // [{id, full_name}, ...]
    
    // The underlying value is the ID
    const currentManagerId = project[field];

    const fetchManagers = async () => {
        try {
            const data = await projectsService.fetchManagers();
            setManagers(data);
        } catch (err) {
            console.error("Failed to fetch managers:", err);
        }
    };

    const checkAvailability = useCallback(async (managerId, start, end) => {
        if (!managerId || !start) {
            setManagerStatus(null);
            return;
        }

        try {
            setLoading(true);
            const results = await projectsService.checkAvailability(start, end, managerId);
            const result = results[managerId];
            
            if (result && result.conflicts) {
                result.conflicts = result.conflicts.filter(c => c.id !== project.id);
                result.available = result.conflicts.length === 0;
            }
            
            setManagerStatus(result);
        } catch (err) {
            console.error("Availability check failed:", err);
        } finally {
            setLoading(false);
        }
    }, [project.id]);

    useEffect(() => {
        fetchManagers();
    }, []);

    useEffect(() => {
        if (currentManagerId) {
            checkAvailability(
                currentManagerId, 
                project.dispatch_date, 
                project.dismantling_date
            );
        } else {
            setManagerStatus(null);
        }
    }, [currentManagerId, project.dispatch_date, project.dismantling_date, checkAvailability]);

    const handleChange = (e) => {
        const newId = e.target.value ? parseInt(e.target.value, 10) : null;
        if (currentManagerId !== newId) {
            updateProjectFull(project.id, { [field]: newId });
        }
    };

    const currentManagerName = useMemo(() => {
        const m = managers.find(m => m.id === currentManagerId);
        return m ? m.full_name : 'Unassigned';
    }, [currentManagerId, managers]);

    const StatusIcon = () => {
        if (loading) return <Loader2 size={14} className="spin" color="var(--tx3)" />;
        if (!managerStatus || !currentManagerId) return <Info size={14} color="var(--tx3)" />;
        
        if (managerStatus.available) {
            return <CheckCircle size={14} color="var(--green)" title="Manager is available" />;
        } else {
            return (
                <div title={`${managerStatus.conflicts.length} overlapping projects`} style={{ display: 'flex', alignItems: 'center' }}>
                    <AlertCircle size={14} color="var(--red)" />
                </div>
            );
        }
    };

    return (
        <div style={{ position: 'relative' }}>
            <div style={{ padding: '16px', border: '1px solid var(--bd)', borderRadius: 'var(--r-md)', background: 'var(--bg-card)', transition: 'border-color 0.2s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--tx3)', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
                    <div 
                        onClick={() => currentManagerId && setIsModalOpen(true)}
                        style={{ cursor: currentManagerId ? 'pointer' : 'default', display: 'flex', gap: '4px', alignItems: 'center' }}
                    >
                        <StatusIcon />
                    </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
                    <Icon size={14} color="var(--tx3)" />
                    <select 
                        value={currentManagerId || ''}
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
                        <option value="">Unassigned</option>
                        {managers.map(m => (
                            <option key={m.id} value={m.id}>{m.full_name}</option>
                        ))}
                    </select>
                    <ChevronDown size={14} color="var(--tx3)" style={{ pointerEvents: 'none' }} />
                </div>
                
                {managerStatus && !managerStatus.available && (
                    <div style={{ 
                        marginTop: '10px', padding: '8px', background: 'var(--red-ghost)', 
                        borderRadius: '6px', fontSize: '11px', color: 'var(--red)',
                        display: 'flex', flexDirection: 'column', gap: '4px',
                        border: '1px solid var(--red-glow)'
                    }}>
                        <div style={{ fontWeight: 700 }}>CONFLICT DETECTED:</div>
                        {managerStatus.conflicts.map(c => (
                            <div key={c.id}>• Overlaps with Proj #{c.id}: {c.project_name}</div>
                        ))}
                    </div>
                )}
            </div>

            {isModalOpen && (
                <ManagerAvailabilityModal 
                    managerId={currentManagerId} 
                    managerName={currentManagerName}
                    onClose={() => setIsModalOpen(false)} 
                />
            )}
        </div>
    );
}
