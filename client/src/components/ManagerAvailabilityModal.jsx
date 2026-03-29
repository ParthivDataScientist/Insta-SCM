import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, Briefcase, CheckCircle, AlertCircle, Clock, ChevronRight } from 'lucide-react';
import projectsService from '../api/projects';
import { formatDateDisplay } from '../utils/dateUtils';

/**
 * ManagerAvailabilityModal Component
 * Shows manager workload, status, and timeline in a premium UI.
 */
export default function ManagerAvailabilityModal({ managerName, onClose }) {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadManagerData = async () => {
            try {
                setLoading(true);
                const data = await projectsService.fetchManagerProjects(managerName);
                // Sort projects by date
                const sorted = data.sort((a, b) => {
                    const dateA = new Date(a.material_dispatch_date || '9999-12-31');
                    const dateB = new Date(b.material_dispatch_date || '9999-12-31');
                    return dateA - dateB;
                });
                setProjects(sorted);
            } catch (err) {
                console.error("Failed to load manager projects:", err);
                setError("Could not load availability data.");
            } finally {
                setLoading(false);
            }
        };

        if (managerName) {
            loadManagerData();
        }
    }, [managerName]);

    // Calculate Current Status
    const availabilityData = useMemo(() => {
        if (!projects.length) return { status: 'Available', color: 'var(--green)', conflicts: [] };
        
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const currentProjects = projects.filter(p => {
            const start = p.material_dispatch_date ? new Date(p.material_dispatch_date) : null;
            const end = p.dismantling_date ? new Date(p.dismantling_date) : null;
            
            if (!start) return false;
            
            // If dismantle date is missing, we assume occupied from dispatch onwards
            if (!end) return now >= start;
            
            return now >= start && now <= end;
        });

        const isOccupied = currentProjects.length > 0;
        
        return {
            status: isOccupied ? 'Occupied' : 'Available',
            color: isOccupied ? 'var(--red)' : 'var(--green)',
            currentProjects
        };
    }, [projects]);

    // Calculate free gaps
    const gaps = useMemo(() => {
        const g = [];
        if (projects.length < 2) return g;

        for (let i = 0; i < projects.length - 1; i++) {
            const currentEnd = projects[i].dismantling_date ? new Date(projects[i].dismantling_date) : null;
            const nextStart = projects[i+1].material_dispatch_date ? new Date(projects[i+1].material_dispatch_date) : null;

            if (currentEnd && nextStart) {
                const diffTime = nextStart - currentEnd;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) - 1;
                
                if (diffDays > 0) {
                    g.push({
                        from: currentEnd,
                        to: nextStart,
                        days: diffDays
                    });
                }
            }
        }
        return g;
    }, [projects]);

    if (!managerName) return null;

    return (
        <div className="modal-backdrop-animate" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px'
        }}>
            <div className="modal-content-animate" style={{
                background: 'var(--bg-card)',
                width: '700px', maxWidth: '100%',
                maxHeight: '90vh',
                borderRadius: 'var(--r-lg)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                border: '1px solid var(--bd)'
            }}>
                {/* Header */}
                <div style={{
                    padding: '24px', borderBottom: '1px solid var(--bd)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'linear-gradient(to right, var(--bg-card), var(--bg-ralt))'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                            width: '48px', height: '48px', borderRadius: '12px',
                            background: availabilityData.color + '20', color: availabilityData.color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Briefcase size={24} />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--tx)' }}>{managerName}</h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: availabilityData.color }} />
                                <span style={{ fontSize: '13px', fontWeight: 600, color: availabilityData.color }}>{availabilityData.status}</span>
                                <span style={{ color: 'var(--tx3)', fontSize: '13px' }}>•</span>
                                <span style={{ color: 'var(--tx2)', fontSize: '13px', fontWeight: 500 }}>{projects.length} Total Projects</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ color: 'var(--tx3)', padding: '8px', borderRadius: 'var(--r-sm)' }} className="icon-btn">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '24px', overflowY: 'auto' }} className="no-scrollbar">
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--tx3)' }}>
                            <div className="spin" style={{ marginBottom: '12px' }}><Clock size={24} /></div>
                            Loading availability data...
                        </div>
                    ) : error ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--red)' }}>
                            <AlertCircle size={24} style={{ marginBottom: '12px' }} />
                            <div>{error}</div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            
                            {/* Stats Cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div style={{ padding: '16px', background: 'var(--bg-ralt)', borderRadius: 'var(--r-md)', border: '1px solid var(--bd)' }}>
                                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--tx3)', fontWeight: 700, marginBottom: '8px' }}>Active Projects</div>
                                    <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--tx)' }}>{availabilityData.currentProjects.length}</div>
                                </div>
                                <div style={{ padding: '16px', background: 'var(--bg-ralt)', borderRadius: 'var(--r-md)', border: '1px solid var(--bd)' }}>
                                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--tx3)', fontWeight: 700, marginBottom: '8px' }}>Next Available Gap</div>
                                    <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--tx)' }}>
                                        {gaps.length > 0 ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Calendar size={14} color="var(--green)" />
                                                {formatDateDisplay(gaps[0].from.toISOString().split('T')[0])}
                                            </div>
                                        ) : 'No Gaps'}
                                    </div>
                                </div>
                            </div>

                            {/* Timeline Section */}
                            <div>
                                <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: 'var(--tx)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Clock size={18} color="var(--red)" /> Detailed Timeline
                                </h3>
                                
                                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {projects.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--tx3)', border: '1px dashed var(--bd)', borderRadius: 'var(--r-md)' }}>
                                            No projects assigned to this manager.
                                        </div>
                                    ) : projects.map((p, idx) => {
                                        const isCurrent = availabilityData.currentProjects.some(cp => cp.id === p.id);
                                        const hasNoDismantle = !p.dismantling_date;
                                        
                                        return (
                                            <React.Fragment key={p.id}>
                                                <div style={{
                                                    padding: '16px',
                                                    borderRadius: 'var(--r-md)',
                                                    border: isCurrent ? '1.5px solid var(--red)' : '1px solid var(--bd)',
                                                    background: isCurrent ? 'var(--red-ghost)' : 'var(--bg-card)',
                                                    transition: 'all 0.2s ease',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}>
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                            {isCurrent && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--red)' }} />}
                                                            <div style={{ fontWeight: 700, color: 'var(--tx)', fontSize: '14px' }}>{p.project_name}</div>
                                                            <span style={{ fontSize: '11px', padding: '2px 6px', background: 'var(--bg-in)', borderRadius: '4px', color: 'var(--tx3)', fontWeight: 600 }}>ID: {p.id}</span>
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: 'var(--tx3)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={12} /> {formatDateDisplay(p.material_dispatch_date)} → {formatDateDisplay(p.dismantling_date) || 'TBD'}</span>
                                                            {p.event_name && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Briefcase size={12} /> {p.event_name}</span>}
                                                        </div>
                                                    </div>
                                                    {hasNoDismantle && (
                                                        <div title="Missing dismantle date" style={{ color: 'var(--org)', display: 'flex', alignItems: 'center' }}>
                                                            <AlertCircle size={16} />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Gap Visualization */}
                                                {gaps.some(g => g.from === (p.dismantling_date ? new Date(p.dismantling_date) : null)) && (
                                                    <div style={{
                                                        display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 16px',
                                                        fontSize: '11px', fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.5px'
                                                    }}>
                                                        <div style={{ flex: 1, height: '1px', background: 'var(--green)', opacity: 0.3 }} />
                                                        <span>{gaps.find(g => g.from.toISOString().split('T')[0] === p.dismantling_date)?.days} Days Free</span>
                                                        <div style={{ flex: 1, height: '1px', background: 'var(--green)', opacity: 0.3 }} />
                                                    </div>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Footer */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid var(--bd)', background: 'var(--bg-ralt)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{
                        padding: '8px 24px', background: 'var(--tx)', color: 'var(--bg-card)',
                        borderRadius: 'var(--r-md)', fontSize: '13px', fontWeight: 600
                    }}>
                        Close Overview
                    </button>
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .spin { animation: spin 2s linear infinite; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}} />
        </div>
    );
}
