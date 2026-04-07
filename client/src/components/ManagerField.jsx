import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { User, CheckCircle, AlertCircle, Info, Loader2, ChevronDown, Edit2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import projectsService from '../api/projects';
import ManagerAvailabilityModal from './ManagerAvailabilityModal';
import { formatDateDisplay } from '../utils/dateUtils';

/**
 * ManagerField Component
 * Handles manager assignment using IDs with smart availability checking and smooth UX.
 */
// Wrap with React.memo to prevent unnecessary re-renders
const ManagerField = React.memo(({ 
    label, 
    field, 
    project, 
    updateProjectFull,
    icon: Icon = User
}) => {
    const [managerStatus, setManagerStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    
    const { data: managers = [] } = useQuery({
        queryKey: ['managers_list'],
        queryFn: projectsService.fetchManagers,
        staleTime: 30000,
    });
    
    const currentManagerId = project[field];

    const checkAvailability = useCallback(async (managerId, start, end) => {
        if (!managerId || !start) {
            setManagerStatus(null);
            return;
        }

        try {
            setLoading(true);
            const results = await projectsService.checkAvailability(start, end, managerId, project.id || null);
            const result = results[managerId];
            setManagerStatus(result);
        } catch (err) {
            console.error("Availability check failed:", err);
        } finally {
            setLoading(false);
        }
    }, [project.id]);

    useEffect(() => {
        if (currentManagerId) {
            checkAvailability(
                currentManagerId, 
                project.dispatch_date || project.event_start_date || new Date().toISOString().split('T')[0],
                project.dismantling_date || project.event_end_date || null
            );
        } else {
            setManagerStatus(null);
        }
    }, [currentManagerId, project.dispatch_date, project.dismantling_date, project.event_start_date, project.event_end_date, checkAvailability]);

    const handleChange = useCallback((e) => {
        const newId = e.target.value ? parseInt(e.target.value, 10) : null;
        if (currentManagerId !== newId) {
            updateProjectFull(project.id, { [field]: newId });
        }
        setIsEditing(false); // Close edit mode on change
    }, [currentManagerId, project.id, field, updateProjectFull]);

    const currentManagerName = useMemo(() => {
        const m = managers.find(m => m.id === currentManagerId);
        return m ? m.full_name : 'Unassigned';
    }, [currentManagerId, managers]);

    const availabilityWindows = useMemo(() => managerStatus?.available_windows || [], [managerStatus]);

    const StatusIcon = useCallback(() => {
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
    }, [loading, managerStatus, currentManagerId]);

    return (
        <div style={{ position: 'relative' }}>
            <motion.div 
                layout
                style={{ 
                    padding: '16px', 
                    border: '1px solid var(--bd)', 
                    borderRadius: 'var(--r-md)', 
                    background: 'var(--bg-card)', 
                    transition: 'box-shadow 0.2s',
                }}
                whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--tx3)', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
                    <div 
                        onClick={() => currentManagerId && setIsModalOpen(true)}
                        style={{ cursor: currentManagerId ? 'pointer' : 'default', display: 'flex', gap: '4px', alignItems: 'center' }}
                    >
                        <StatusIcon />
                    </div>
                </div>
                
                <AnimatePresence mode="wait">
                    {!isEditing ? (
                        <motion.div 
                            key="view-mode"
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            transition={{ duration: 0.15 }}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Icon size={16} color="var(--tx2)" />
                                <span style={{ fontSize: '14px', fontWeight: 600, color: currentManagerId ? 'var(--tx)' : 'var(--tx3)' }}>
                                    {currentManagerName}
                                </span>
                            </div>
                            
                            <motion.button 
                                whileTap={{ scale: 0.95 }}
                                onClick={(e) => { e.preventDefault(); setIsEditing(true); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                    background: 'var(--bg-in)', border: '1px solid var(--bd)',
                                    padding: '4px 8px', borderRadius: '4px',
                                    fontSize: '11px', fontWeight: 600, color: 'var(--tx2)',
                                    cursor: 'pointer'
                                }}
                            >
                                <Edit2 size={12} />
                                Change
                            </motion.button>
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="edit-mode"
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 5 }}
                            transition={{ duration: 0.15 }}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}
                        >
                            <Icon size={14} color="var(--tx3)" />
                            <select 
                                value={currentManagerId || ''}
                                onChange={handleChange}
                                autoFocus
                                style={{
                                    flex: 1,
                                    background: 'var(--bg-in)',
                                    border: '1px solid var(--bd)',
                                    padding: '6px 8px',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    color: 'var(--tx)',
                                    outline: 'none',
                                    cursor: 'pointer',
                                }}
                            >
                                <option value="">Unassigned</option>
                                {managers.map(m => (
                                    <option key={m.id} value={m.id}>{m.full_name}</option>
                                ))}
                            </select>
                            <motion.button 
                                whileTap={{ scale: 0.95 }}
                                onClick={(e) => { e.preventDefault(); setIsEditing(false); }}
                                title="Cancel"
                                style={{
                                    background: 'transparent', border: 'none',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                                    color: 'var(--tx3)',
                                    padding: '4px'
                                }}
                            >
                                <X size={16} />
                            </motion.button>
                        </motion.div>
                    )}
                </AnimatePresence>
                
                <AnimatePresence>
                    {managerStatus && !managerStatus.available && !isEditing && (
                        <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            style={{ 
                                marginTop: '10px', padding: '8px', background: 'var(--red-ghost)', 
                                borderRadius: '6px', fontSize: '11px', color: 'var(--red)',
                                display: 'flex', flexDirection: 'column', gap: '4px',
                                border: '1px solid var(--red-glow)', overflow: 'hidden'
                            }}
                        >
                            <div style={{ fontWeight: 700 }}>CONFLICT DETECTED (override allowed):</div>
                            {managerStatus.conflicts.map(c => (
                                <div key={c.id}>- Overlaps with {c.crm_project_id || `PRJ-${String(c.id).padStart(5, '0')}`}: {c.project_name}</div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {currentManagerId && availabilityWindows.length > 0 && !isEditing && (
                        <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            style={{
                                marginTop: '10px',
                                padding: '8px',
                                background: 'var(--bg-in)',
                                borderRadius: '6px',
                                fontSize: '11px',
                                color: 'var(--tx2)',
                                border: '1px solid var(--bd)',
                                overflow: 'hidden'
                            }}
                        >
                            <div style={{ fontWeight: 700, color: 'var(--green)', marginBottom: '4px' }}>AVAILABLE WINDOWS</div>
                            {availabilityWindows.slice(0, 3).map((window, index) => (
                                <div key={`${window.start_date}-${window.end_date || 'open'}-${index}`}>
                                    {formatDateDisplay(window.start_date)} to {window.end_date ? formatDateDisplay(window.end_date) : 'Open'}
                                </div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {isModalOpen && (
                <ManagerAvailabilityModal 
                    managerId={currentManagerId} 
                    managerName={currentManagerName}
                    onClose={() => setIsModalOpen(false)} 
                />
            )}
        </div>
    );
});

export default ManagerField;
