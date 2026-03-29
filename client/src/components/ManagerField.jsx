import React, { useState, useEffect, useCallback } from 'react';
import { User, CheckCircle, AlertCircle, Info, Clock, Loader2 } from 'lucide-react';
import projectsService from '../api/projects';
import ManagerAvailabilityModal from './ManagerAvailabilityModal';

/**
 * ManagerField Component
 * Handles manager assignment with smart availability checking and conflict detection.
 */
export default function ManagerField({ 
    label, 
    field, 
    project, 
    updateProjectFull,
    icon: Icon = User
}) {
    const [managerStatus, setManagerStatus] = useState(null); // { available: bool, conflicts: [] }
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [localValue, setLocalValue] = useState(project[field] || '');

    const checkAvailability = useCallback(async (managerName, start, end) => {
        if (!managerName || !start) {
            setManagerStatus(null);
            return;
        }

        try {
            setLoading(true);
            const results = await projectsService.checkAvailability(start, end, managerName);
            const result = results[managerName];
            
            // Filter out current project from conflicts
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

    const [allManagersAvailability, setAllManagersAvailability] = useState({});

    const checkAllAvailability = useCallback(async (start, end) => {
        if (!start) return;
        try {
            const results = await projectsService.checkAvailability(start, end);
            setAllManagersAvailability(results);
        } catch (err) {
            console.error("All availability check failed:", err);
        }
    }, []);

    useEffect(() => {
        setLocalValue(project[field] || '');
        checkAvailability(
            project[field], 
            project.material_dispatch_date, 
            project.dismantling_date
        );
        checkAllAvailability(
            project.material_dispatch_date,
            project.dismantling_date
        );
    }, [project[field], project.material_dispatch_date, project.dismantling_date, checkAvailability, checkAllAvailability, field]);

    const handleBlur = (e) => {
        const newValue = e.target.value;
        if (project[field] !== newValue) {
            updateProjectFull(project.id, { [field]: newValue });
        }
    };

    const StatusIcon = () => {
        if (loading) return <Loader2 size={14} className="spin" color="var(--tx3)" />;
        if (!managerStatus || !localValue) return <Info size={14} color="var(--tx3)" />;
        
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
                        onClick={() => localValue && setIsModalOpen(true)}
                        style={{ cursor: localValue ? 'pointer' : 'default', display: 'flex', gap: '4px', alignItems: 'center' }}
                    >
                        <StatusIcon />
                    </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Icon size={14} color="var(--tx3)" style={{ cursor: localValue ? 'pointer' : 'default' }} onClick={() => localValue && setIsModalOpen(true)} />
                    <input 
                        type="text"
                        list={`managers-list-${project.id}`}
                        value={localValue}
                        onChange={(e) => setLocalValue(e.target.value)}
                        onBlur={handleBlur}
                        placeholder="Assign manager..."
                        style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            borderBottom: '1px solid transparent',
                            fontSize: '14px',
                            fontWeight: 600,
                            color: 'var(--tx)',
                            outline: 'none',
                            paddingBottom: '2px'
                        }}
                        onFocus={(e) => e.target.style.borderBottom = '1px solid var(--org)'}
                    />
                    <datalist id={`managers-list-${project.id}`}>
                        {Object.entries(allManagersAvailability).map(([name, status]) => (
                            <option key={name} value={name}>
                                {status.available ? '✅ Available' : '❌ Conflicting'}
                            </option>
                        ))}
                    </datalist>
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
                    managerName={localValue} 
                    onClose={() => setIsModalOpen(false)} 
                />
            )}
        </div>
    );
}
