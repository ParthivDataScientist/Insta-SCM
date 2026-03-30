import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Clock, User, MessageSquare, Maximize2, Minimize2, Plus, Image as ImageIcon, CheckCircle, Circle, Trash2, Camera } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { sanitize, stripTags } from '../utils/sanitizer';
import CalendarPicker from './CalendarPicker';
import { formatDateDisplay } from '../utils/dateUtils';
import ManagerField from './ManagerField';
import ClientField from './ClientField';

export default function ProjectBoardModal({ project, onClose, updateProjectFull }) {
    const { user } = useAuth();
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(true);
    const [activeTab, setActiveTab] = useState('Details');
    const [newComment, setNewComment] = useState("");
    const [hoveredPhoto, setHoveredPhoto] = useState(null);
    const [fullScreenPhoto, setFullScreenPhoto] = useState(null);
    const chatEndRef = useRef(null);

    const scrollToBottom = () => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    };

    // Fallbacks to empty arrays if null/undefined
    const comments = project?.comments || [];

    useEffect(() => {
        scrollToBottom();
    }, [comments.length]);
    const materials = project?.materials || [];
    const qcSteps = project?.qc_steps || [];
    const photos = project?.photos || [];

    // Local states for inputs
    const [newMaterial, setNewMaterial] = useState({ name: '', quantity: '', status: 'Pending', supplier: '', expected: '' });
    const [newQcStep, setNewQcStep] = useState("");

    if (!project) return null;

    // ----- Handlers for Chat -----
    const handleSendComment = async () => {
        if (!newComment.trim()) return;
        const initials = user?.full_name ? user.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';
        const newMsg = {
            initials: initials,
            name: user?.full_name || 'User',
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute:'2-digit' }),
            text: stripTags(newComment), 
            color: '#D1FAE5',
            textCol: '#059669'
        };
        const updatedComments = [...comments, newMsg];
        setNewComment("");
        await updateProjectFull(project.id, { comments: updatedComments });
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSendComment();
    };

    // ----- Handlers for Materials -----
    const handleAddMaterial = async () => {
        if (!newMaterial.name) return;
        const updatedMaterials = [...materials, { ...newMaterial, id: Date.now() }];
        setNewMaterial({ name: '', quantity: '', status: 'Pending', supplier: '', expected: '' });
        await updateProjectFull(project.id, { materials: updatedMaterials });
    };

    const handleDeleteMaterial = async (idToRemove) => {
        const updatedMaterials = materials.filter(m => m.id !== idToRemove);
        await updateProjectFull(project.id, { materials: updatedMaterials });
    };

    const handleDeletePhoto = async (idToRemove) => {
        const updatedPhotos = photos.filter(p => p.id !== idToRemove);
        await updateProjectFull(project.id, { photos: updatedPhotos });
    };

    // ----- Handlers for Photos -----
    const handlePhotoUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result;
            const updatedPhotos = [{ id: Date.now(), url: base64String, added_at: new Date().toLocaleDateString() }, ...photos];
            await updateProjectFull(project.id, { photos: updatedPhotos });
        };
        // Quick visual/size optimization: read as data url but normally resize in prod.
        reader.readAsDataURL(file);
    };

    // ----- Handlers for QC Steps -----
    const handleAddQcStep = async () => {
        if (!newQcStep.trim()) return;
        const updatedQc = [...qcSteps, { id: Date.now(), step: newQcStep, completed: false }];
        setNewQcStep("");
        await updateProjectFull(project.id, { qc_steps: updatedQc });
    };

    const toggleQcStep = async (stepId) => {
        const updatedQc = qcSteps.map(s => s.id === stepId ? { ...s, completed: !s.completed } : s);
        await updateProjectFull(project.id, { qc_steps: updatedQc });
    };

    const handleDeleteQcStep = async (stepId) => {
        const updatedQc = qcSteps.filter(s => s.id !== stepId);
        await updateProjectFull(project.id, { qc_steps: updatedQc });
    };


    // Helper rendering
    const renderTabContent = () => {
        switch (activeTab) {
            case 'Details':
                const DateDetailField = ({ label, field, icon: Icon }) => {
                    const [rect, setRect] = useState(null);
                    const [isEditing, setIsEditing] = useState(false);
                    const value = project[field] || '';

                    return (
                        <div 
                            onClick={(e) => {
                                const r = e.currentTarget.getBoundingClientRect();
                                setRect(r);
                                setIsEditing(true);
                            }}
                            style={{ padding: '16px', border: '1px solid var(--bd)', borderRadius: 'var(--r-md)', background: 'var(--bg-card)', cursor: 'pointer', position: 'relative' }}
                        >
                            <div style={{ fontSize: '11px', color: 'var(--tx3)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {Icon && <Icon size={14} color="var(--tx3)" />}
                                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--tx)' }}>
                                    {formatDateDisplay(value) || 'Set Date...'}
                                </div>
                            </div>
                            {isEditing && rect && (
                                <CalendarPicker 
                                    initialDate={value}
                                    anchorRect={rect}
                                    onSelect={(date) => {
                                        updateProjectFull(project.id, { [field]: date });
                                        setIsEditing(false);
                                    }}
                                    onClose={() => setIsEditing(false)}
                                />
                            )}
                        </div>
                    );
                };

                const TextField = ({ label, field, icon: Icon }) => (
                    <div style={{ padding: '16px', border: '1px solid var(--bd)', borderRadius: 'var(--r-md)', background: 'var(--bg-card)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--tx3)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {Icon && <Icon size={14} color="var(--tx3)" />}
                            <input 
                                type="text"
                                defaultValue={project[field] || ''}
                                onBlur={(e) => updateProjectFull(project.id, { [field]: e.target.value })}
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
                        </div>
                    </div>
                );

                return (
                    <>
                        <div style={{
                            width: '100%', height: '180px', background: '#1a1a1a', borderRadius: 'var(--r-md)',
                            marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666',
                            position: 'relative', overflow: 'hidden'
                        }}>
                             <img src="/logo.jpg" alt="Booth Render" style={{ opacity: 0.15, width: '200px' }} />
                             <div style={{ position: 'absolute', bottom: '12px', right: '12px', fontSize: '10px', color: '#444' }}>[ Exhibition Booth Render Placeholder ]</div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                            <ManagerField label="Project Manager" field="manager_id" project={project} updateProjectFull={updateProjectFull} icon={User} />
                            <ClientField label="Client" field="client_id" project={project} updateProjectFull={updateProjectFull} />
                        </div>

                        <div style={{ padding: '24px', border: '1px solid var(--bd)', borderRadius: 'var(--r-md)', background: 'var(--bg-ralt)' }}>
                            <h3 style={{ fontSize: '15px', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Clock size={18} color="var(--org)" /> Event & Installation Timeline
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <TextField label="Show Name" field="event_name" />
                                <TextField label="Venue" field="venue" />
                                <DateDetailField label="Event Start" field="event_start_date" />
                                <DateDetailField label="Event End" field="event_end_date" />
                                <DateDetailField label="Installs Start" field="installation_start_date" />
                                <DateDetailField label="Installs End" field="installation_end_date" />
                                <DateDetailField label="Material Dispatch" field="dispatch_date" />
                                <DateDetailField label="Dismantling Date" field="dismantling_date" />
                                <TextField label="Branch" field="branch" />
                            </div>
                        </div>
                    </>
                );

            case 'Materials':
                return (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, fontSize: '16px' }}>Materials Logistics</h3>
                        </div>
                        {/* Add material inputs */}
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: '8px', marginBottom: '16px' }}>
                            <input value={newMaterial.name} onChange={e => setNewMaterial({...newMaterial, name: e.target.value})} placeholder="Material Name" style={{ padding: '8px', border: '1px solid var(--bd)', borderRadius: '4px' }} />
                            <input value={newMaterial.quantity} onChange={e => setNewMaterial({...newMaterial, quantity: e.target.value})} placeholder="Qty" style={{ padding: '8px', border: '1px solid var(--bd)', borderRadius: '4px' }} />
                            <select value={newMaterial.status} onChange={e => setNewMaterial({...newMaterial, status: e.target.value})} style={{ padding: '8px', border: '1px solid var(--bd)', borderRadius: '4px' }}>
                                <option>Pending</option><option>Ordered</option><option>In Stock</option><option>Missing</option>
                            </select>
                            <input value={newMaterial.supplier} onChange={e => setNewMaterial({...newMaterial, supplier: e.target.value})} placeholder="Supplier" style={{ padding: '8px', border: '1px solid var(--bd)', borderRadius: '4px' }} />
                            <input value={newMaterial.expected} onChange={e => setNewMaterial({...newMaterial, expected: e.target.value})} placeholder="Expected Date" type="date" style={{ padding: '8px', border: '1px solid var(--bd)', borderRadius: '4px' }} />
                            <button onClick={handleAddMaterial} style={{ padding: '8px', background: 'var(--tx)', color: 'var(--bg)', border: 'none', borderRadius: '4px', cursor: 'pointer' }}><Plus size={18} /></button>
                        </div>

                        {/* Materials Table */}
                        <div style={{ border: '1px solid var(--bd)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--bd)' }}>
                                        <th style={{ padding: '12px' }}>MATERIAL</th>
                                        <th style={{ padding: '12px' }}>QUANTITY</th>
                                        <th style={{ padding: '12px' }}>STATUS</th>
                                        <th style={{ padding: '12px' }}>SUPPLIER</th>
                                        <th style={{ padding: '12px' }}>EXPECTED</th>
                                        <th style={{ padding: '12px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {materials.map((m) => (
                                        <tr key={m.id} style={{ borderBottom: '1px solid var(--bd)' }}>
                                            <td style={{ padding: '12px', fontWeight: 500 }}>{stripTags(m.name)}</td>
                                            <td style={{ padding: '12px' }}>{m.quantity}</td>
                                            <td style={{ padding: '12px' }}>
                                                <span style={{ 
                                                    padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                                                    background: m.status === 'In Stock' ? '#D1FAE5' : m.status === 'Ordered' ? '#FEE2E2' : '#FEF3C7',
                                                    color: m.status === 'In Stock' ? '#059669' : m.status === 'Ordered' ? '#DC2626' : '#D97706'
                                                }}>
                                                    {m.status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px' }}>{m.supplier || '-'}</td>
                                            <td style={{ padding: '12px' }}>{m.expected || '-'}</td>
                                            <td style={{ padding: '12px', width: '40px' }}>
                                                <button onClick={() => handleDeleteMaterial(m.id)} style={{ background: 'none', border:'none', cursor:'pointer', color:'var(--tx3)' }}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {materials.length === 0 && <tr><td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: 'var(--tx3)' }}>No materials added.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );

            case 'Photos':
                return (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, fontSize: '16px' }}>Project Photos & Execution</h3>
                            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--tx)', color: 'var(--bg)', padding: '8px 16px', borderRadius: '4px', fontSize: '13px', fontWeight: 500 }}>
                                <Camera size={16} /> Add Photo
                                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
                            </label>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                            {photos.map(p => (
                                <div 
                                    key={p.id} 
                                    onMouseEnter={() => setHoveredPhoto(p.id)}
                                    onMouseLeave={() => setHoveredPhoto(null)}
                                    style={{ border: '1px solid var(--bd)', borderRadius: 'var(--r-md)', overflow: 'hidden', position: 'relative' }}
                                >
                                    <div style={{ height: '150px', backgroundImage: `url(${p.url})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />
                                    <div style={{ padding: '8px', fontSize: '11px', color: 'var(--tx3)' }}>Added: {p.added_at}</div>
                                    
                                    {/* Camouflage Hover Overlay */}
                                    {hoveredPhoto === p.id && (
                                        <div style={{
                                            position: 'absolute', top: 0, left: 0, right: 0, height: '150px',
                                            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', 
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px'
                                        }}>
                                            <button 
                                                onClick={() => setFullScreenPhoto(p.url)}
                                                style={{ background: 'var(--tx)', color: 'var(--bg)', border: 'none', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
                                            >
                                                View HD
                                            </button>
                                            <button 
                                                onClick={() => handleDeletePhoto(p.id)}
                                                style={{ background: 'rgba(239, 68, 68, 0.9)', color: 'white', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {photos.length === 0 && <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--tx3)' }}>No photos uploaded yet.</div>}
                        </div>
                    </div>
                );

            case 'QC':
                return (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, fontSize: '16px' }}>QC & Execution Checklist</h3>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                            <input 
                                value={newQcStep}
                                onChange={(e) => setNewQcStep(e.target.value)}
                                placeholder="E.g., Check electrical wiring under deck"
                                style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--bd)', borderRadius: '4px' }}
                            />
                            <button onClick={handleAddQcStep} style={{ padding: '10px 16px', background: 'var(--tx)', color: 'var(--bg)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}>Add Step</button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {qcSteps.map(step => (
                                <div key={step.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', border: '1px solid var(--bd)', borderRadius: '4px', background: 'var(--bg-card)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => toggleQcStep(step.id)}>
                                        {step.completed ? <CheckCircle size={20} color="#10B981" /> : <Circle size={20} color="var(--tx3)" />}
                                        <span style={{ textDecoration: step.completed ? 'line-through' : 'none', color: step.completed ? 'var(--tx3)' : 'var(--tx)', fontSize: '14px' }}>
                                            {stripTags(step.step)}
                                        </span>
                                    </div>
                                    <button onClick={() => handleDeleteQcStep(step.id)} style={{ background: 'none', border:'none', cursor:'pointer', color:'var(--red-v)' }}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                            {qcSteps.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: 'var(--tx3)' }}>No QC steps defined.</div>}
                        </div>
                    </div>
                );

            default:
                return <div style={{ padding: '20px', textAlign: 'center', color: 'var(--tx3)' }}>Tab functionality coming soon.</div>;
        }
    };


    return (
        <div 
            className="modal-backdrop-animate"
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)',
                zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '20px'
            }}
        >
            <div 
                className="modal-content-animate"
                style={{
                    background: 'var(--bg-card)', 
                    width: isFullscreen ? '100vw' : '900px', 
                    maxWidth: isFullscreen ? '100vw' : '95vw',
                    height: isFullscreen ? '100vh' : '80vh', 
                    borderRadius: isFullscreen ? '0' : 'var(--r-md)', 
                    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                    display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '24px', borderBottom: '1px solid var(--bd)', display: 'flex',
                    alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
                }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--tx)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            Proj # {project.id} | {project.project_name} | {project.area || 'Size TBD'} | {project.event_name}
                        </h2>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                            <span style={{ padding: '4px 10px', background: '#10B981', color: 'white', fontSize: '11px', borderRadius: '99px', fontWeight: 600 }}>{project.stage || 'Status TBD'}</span>
                            <span style={{ padding: '4px 10px', background: '#3B82F6', color: 'white', fontSize: '11px', borderRadius: '99px', fontWeight: 600 }}>I&D: Inhouse</span>
                        </div>
                    </div>
                    
                    {/* Header Controls */}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <button 
                            className="btn-animate" 
                            onClick={() => setIsChatOpen(!isChatOpen)} 
                            title={isChatOpen ? "Hide Chat" : "Show Chat"} 
                            style={{ background: isChatOpen ? 'var(--org-light)' : 'none', border: 'none', cursor: 'pointer', color: isChatOpen ? 'var(--org)' : 'var(--tx2)', padding: '6px', borderRadius: '4px' }}
                        >
                            <MessageSquare size={20} />
                        </button>
                        <button className="btn-animate" onClick={() => setIsFullscreen(!isFullscreen)} title="Toggle Fullscreen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx2)', padding: '4px' }}>
                            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                        </button>
                        <button className="btn-animate" onClick={onClose} title="Close Panel" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red-v)', padding: '4px' }}>
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    
                    {/* Main Content Area */}
                    <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }} className="no-scrollbar">
                        <div style={{ display: 'flex', borderBottom: '1px solid var(--bd)', marginBottom: '20px' }}>
                            {['Details', 'Materials', 'Files', 'Shipments', 'Photos', 'QC'].map((tab) => (
                                <button key={tab} onClick={() => setActiveTab(tab)} className="btn-animate" style={{
                                    padding: '10px 20px', borderBottom: activeTab === tab ? '2px solid var(--tx)' : '2px solid transparent',
                                    fontWeight: activeTab === tab ? 600 : 500, color: activeTab === tab ? 'var(--tx)' : 'var(--tx3)',
                                    fontSize: '13px', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}>
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {renderTabContent()}

                    </div>

                    {/* Sidebar Comments */}
                    {isChatOpen && (
                        <div 
                            className="message-animate"
                            style={{ width: '320px', borderLeft: '1px solid var(--bd)', background: 'var(--bg-in)', display: 'flex', flexDirection: 'column', transition: 'width 0.3s ease' }}
                        >
                            <div style={{ padding: '16px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
                                    <MessageSquare size={16} color="var(--org)" /> Comments and activity
                                </div>
                            </div>
                            
                            <div style={{ padding: '16px', borderBottom: '1px solid var(--bd)' }}>
                            <div style={{ position: 'relative' }}>
                                <input 
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Write a comment..." 
                                    style={{
                                        width: '100%', padding: '10px 36px 10px 12px', borderRadius: 'var(--r-sm)',
                                        border: '1px solid var(--bd)', background: 'var(--bg-card)', color: 'var(--tx)'
                                    }} 
                                />
                                <button onClick={handleSendComment} title="Send Comment" style={{ position: 'absolute', right: '8px', top: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx3)', padding: '4px' }}>
                                    <Send size={14} />
                                </button>
                            </div>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }} className="no-scrollbar">
                            {/* Render Dynamic Comments */}
                            {comments.map((c, idx) => (
                                <div key={idx} className="message-animate" style={{ display: 'flex', gap: '12px' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: c.color || '#E0E7FF', color: c.textCol || '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0, transition: '0.3s transform ease' }}>
                                        {c.initials}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '12px', marginBottom: '4px' }}><strong>{c.name}</strong> <span style={{ color: 'var(--tx3)' }}>{c.date}</span></div>
                                        <div style={{ fontSize: '13px', color: 'var(--tx2)', lineHeight: 1.4 }} dangerouslySetInnerHTML={{ __html: sanitize(c.text) }} />
                                    </div>
                                </div>
                            ))}
                            {comments.length === 0 && <div style={{ fontSize: '12px', color: 'var(--tx3)', textAlign: 'center', marginTop: '20px' }}>No comments yet.</div>}
                            <div ref={chatEndRef} />
                        </div>
                    </div>
                    )}

                </div>
            </div>

            {/* Full Screen Photo Overlay */}
            {fullScreenPhoto && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100000,
                    background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }} onClick={() => setFullScreenPhoto(null)}>
                    <img 
                        src={fullScreenPhoto} 
                        style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }} 
                        alt="Full view" 
                    />
                    <button style={{ position: 'absolute', top: '24px', right: '32px', background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '8px' }} onClick={() => setFullScreenPhoto(null)}>
                        <X size={32} />
                    </button>
                </div>
            )}
        </div>
    );
}
