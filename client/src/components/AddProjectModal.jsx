import React, { useState } from 'react';
import { X, Save, Briefcase, MapPin, Calendar, User, Info, CheckCircle2 } from 'lucide-react';
import ManagerField from './ManagerField';
import ClientField from './ClientField';

/**
 * AddProjectModal Component
 * Modern data entry form for creating new projects in the normalized schema.
 */
export default function AddProjectModal({ onClose, createProject, refetch }) {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    // Auto-generate a unique project identity
    const generateIdentity = () => {
        const date = new Date().toISOString().slice(2, 10).replace(/-/g, '');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `INSTA-${date}-${random}`;
    };

    const [formData, setFormData] = useState({
        project_name: generateIdentity(),
        client_id: null,
        city: null,
        event_name: null,
        venue: null,
        area: null,
        branch: null,
        manager_id: null,
        stage: 'Open',
        board_stage: 'TBC',
        event_start_date: null,
        event_end_date: null,
        dispatch_date: null,
        installation_start_date: null,
        installation_end_date: null,
        dismantling_date: null,
        comments: [], // Match DB lists
        materials: [],
        photos: [],
        qc_steps: []
    });

    const handleChange = (field, value) => {
        // Normalize empty string to null for optional fields (important for backend validation)
        const normalizedValue = value === '' ? null : value;
        setFormData(prev => ({ ...prev, [field]: normalizedValue }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.project_name) return alert("Project Identity is required");

        // Clean payload: ensure no empty strings are sent for optional fields
        const payload = { ...formData };
        Object.keys(payload).forEach(key => {
            if (payload[key] === '') payload[key] = null;
        });

        try {
            setLoading(true);
            await createProject(payload);
            setSuccess(true);
            if (refetch) await refetch();
            setTimeout(() => {
                onClose();
            }, 1500);
        } catch (err) {
            console.error("Failed to create project:", err);
            // Enhanced error reporting for debugging 422s
            const detail = err.response?.data?.detail;
            const errorMsg = Array.isArray(detail) 
                ? detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join('\n')
                : (err.response?.data?.detail || err.message);
            
            alert(`Validation Error:\n${errorMsg}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px'
        }}>
            <div className="modal-content-animate" style={{
                background: 'var(--bg-card)', 
                width: '800px', maxWidth: '95vw',
                maxHeight: '90vh', borderRadius: 'var(--r-md)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                display: 'flex', flexDirection: 'column', overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{ padding: '24px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-ralt)' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Briefcase size={20} color="var(--org)" /> Create New Project
                        </h2>
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--tx3)' }}>Enter details to initialize a new project in the tracker.</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx3)' }}>
                        <X size={24} />
                    </button>
                </div>

                {success ? (
                    <div style={{ padding: '60px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                        <div style={{ padding: '16px', background: 'var(--green-ghost)', borderRadius: '50%', color: 'var(--green)' }}>
                            <CheckCircle2 size={48} />
                        </div>
                        <h3 style={{ fontSize: '24px', margin: 0 }}>Project Created!</h3>
                        <p style={{ color: 'var(--tx3)' }}>Refreshing your dashboard now...</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '24px' }} className="no-scrollbar">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            {/* Vital Info Section */}
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--blu)', marginBottom: '8px' }}>Project Identity (Unique ID)</label>
                                <div style={{ 
                                    width: '100%', padding: '12px', borderRadius: '8px', 
                                    border: '2px solid var(--b-bd)', background: 'var(--b-bg)', 
                                    color: 'var(--blu)', fontSize: '16px', fontWeight: 800,
                                    letterSpacing: '1px'
                                }}>
                                    {formData.project_name}
                                </div>
                                <p style={{ fontSize: '10px', color: 'var(--tx3)', marginTop: '4px' }}>System-generated unique identifier for tracking.</p>
                            </div>

                            <ClientField 
                                label="Primary Client" 
                                field="client_id" 
                                project={formData} 
                                updateProjectFull={(unused, data) => handleChange('client_id', data.client_id)} 
                            />

                            <ManagerField 
                                label="Responsible Manager" 
                                field="manager_id" 
                                project={formData} 
                                updateProjectFull={(unused, data) => handleChange('manager_id', data.manager_id)} 
                            />

                            {/* Logistics Section */}
                            <div style={{ gridColumn: '1 / -1', marginTop: '12px' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: '8px' }}>Logistics & Location</label>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--tx3)' }}>Event Name</span>
                                <input value={formData.event_name || ""} onChange={e => handleChange('event_name', e.target.value)} placeholder="Exhibition Title" style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--bd)', background: 'var(--bg-in)', color: 'var(--tx)' }} />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--tx3)' }}>Venue</span>
                                <input value={formData.venue || ""} onChange={e => handleChange('venue', e.target.value)} placeholder="Convention Center / Hall" style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--bd)', background: 'var(--bg-in)', color: 'var(--tx)' }} />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--tx3)' }}>City</span>
                                <input value={formData.city || ""} onChange={e => handleChange('city', e.target.value)} placeholder="City" style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--bd)', background: 'var(--bg-in)', color: 'var(--tx)' }} />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--tx3)' }}>Branch</span>
                                <input value={formData.branch || ""} onChange={e => handleChange('branch', e.target.value)} placeholder="Branch Name" style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--bd)', background: 'var(--bg-in)', color: 'var(--tx)' }} />
                            </div>

                            {/* Dates Section */}
                            <div style={{ gridColumn: '1 / -1', marginTop: '12px' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--tx3)', marginBottom: '8px' }}>Schedule & Deadlines</label>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--tx3)' }}>Material Dispatch</span>
                                <input type="date" value={formData.dispatch_date || ""} onChange={e => handleChange('dispatch_date', e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--bd)', background: 'var(--bg-in)', color: 'var(--tx)' }} />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--tx3)' }}>Dismantling Date</span>
                                <input type="date" value={formData.dismantling_date || ""} onChange={e => handleChange('dismantling_date', e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--bd)', background: 'var(--bg-in)', color: 'var(--tx)' }} />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--tx3)' }}>Event Start</span>
                                <input type="date" value={formData.event_start_date || ""} onChange={e => handleChange('event_start_date', e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--bd)', background: 'var(--bg-in)', color: 'var(--tx)' }} />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--tx3)' }}>Event End</span>
                                <input type="date" value={formData.event_end_date || ""} onChange={e => handleChange('event_end_date', e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--bd)', background: 'var(--bg-in)', color: 'var(--tx)' }} />
                            </div>
                        </div>

                        {/* Footer Controls */}
                        <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--bd)', paddingTop: '24px' }}>
                            <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid var(--bd)', background: 'none', color: 'var(--tx2)', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                            <button 
                                type="submit" 
                                disabled={loading}
                                style={{ 
                                    padding: '10px 24px', borderRadius: '6px', border: 'none', 
                                    background: 'var(--red)', color: 'white', fontWeight: 700, 
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' 
                                }}
                            >
                                {loading ? 'Saving...' : <><Save size={18} /> Initialize Project</>}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
