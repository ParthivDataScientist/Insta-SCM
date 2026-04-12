import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Clock, MessageSquare, Maximize2, Minimize2, Plus, CheckCircle, Circle, Trash2, Camera, ExternalLink, Copy, AlertTriangle, Link as LinkIcon, Save } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { sanitize, stripTags } from '../utils/sanitizer';
import CalendarPicker from './CalendarPicker';
import { formatDateDisplay, formatDateTimeDisplay } from '../utils/dateUtils';
import ManagerAssignmentPlanner from './ManagerAssignmentPlanner';
import ProjectBrandAsset from './ProjectBrandAsset';
import ProjectFileResourcePanel from './ProjectFileResourcePanel';
import ProjectPriorityBadge from './ProjectPriorityBadge';
import { EXECUTION_BOARD_STAGES, PROJECT_PRIORITY_OPTIONS, PROJECT_STATUS_OPTIONS, formatProjectPriorityLabel, formatProjectStatusLabel, getProjectCode, normalizeBoardStage, normalizeProjectPriority } from '../utils/projectStatus';
import projectsService from '../api/projects';

const LINK_TYPE_META = {
    drive: { label: 'Drive', color: '#2563EB', bg: 'rgba(37, 99, 235, 0.12)' },
    autocad: { label: 'AutoCAD', color: '#C8792B', bg: 'rgba(200, 121, 43, 0.12)' },
    render: { label: 'Render', color: '#238A5D', bg: 'rgba(35, 138, 93, 0.12)' },
    other: { label: 'Other', color: 'var(--tx2)', bg: 'var(--bg-in)' },
};

export default function ProjectBoardModal({ project, onClose, updateProjectFull, onProjectRefresh = null }) {
    const { user } = useAuth();
    const { theme } = useTheme();
    const projectId = project?.id;
    const isExecutionProject = ['won', 'win', 'confirmed'].includes(String(project?.status || project?.stage || '').trim().toLowerCase());
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(true);
    const [activeTab, setActiveTab] = useState('Details');
    const [newComment, setNewComment] = useState("");
    const [hoveredPhoto, setHoveredPhoto] = useState(null);
    const [fullScreenPhoto, setFullScreenPhoto] = useState(null);
    const [projectLinks, setProjectLinks] = useState([]);
    const [linksLoading, setLinksLoading] = useState(false);
    const [linksError, setLinksError] = useState('');
    const [showLinkForm, setShowLinkForm] = useState(false);
    const [editingLinkId, setEditingLinkId] = useState(null);
    const [linkForm, setLinkForm] = useState({ label: '', link_type: 'drive', url: '' });
    const chatEndRef = useRef(null);
    const canManageTabData = user?.role !== 'VIEWER';

    const scrollToBottom = () => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    };

    // Fallbacks to empty arrays if null/undefined
    const comments = project?.comments || [];
    const revisionHistory = project?.revision_history || [];

    useEffect(() => {
        scrollToBottom();
    }, [comments.length]);
    const materials = project?.materials || [];
    const qcSteps = project?.qc_steps || [];
    const photos = project?.photos || [];

    // Local states for inputs
    const [newMaterial, setNewMaterial] = useState({ name: '', quantity: '', status: 'Pending', supplier: '', expected: '' });
    const [newQcStep, setNewQcStep] = useState("");

    // ----- Handlers for Chat -----
    const handleSendComment = async () => {
        if (!newComment.trim()) return;
        const initials = user?.full_name ? user.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';
        const newMsg = {
            initials: initials,
            name: user?.full_name || 'User',
            date: formatDateTimeDisplay(new Date()),
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
            const updatedPhotos = [{ id: Date.now(), url: base64String, added_at: formatDateDisplay(new Date()) }, ...photos];
            await updateProjectFull(project.id, { photos: updatedPhotos });
        };
        // Quick visual/size optimization: read as data url but normally resize in prod.
        reader.readAsDataURL(file);
    };

    const resetLinkForm = () => {
        setLinkForm({ label: '', link_type: 'drive', url: '' });
        setEditingLinkId(null);
        setShowLinkForm(false);
    };

    const isSafeHttpUrl = (value) => {
        try {
            const parsed = new URL(value);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
            return false;
        }
    };

    const handleSaveLink = async () => {
        const payload = {
            label: linkForm.label.trim(),
            link_type: linkForm.link_type,
            url: linkForm.url.trim(),
        };

        if (!payload.label) {
            alert('Link label is required');
            return;
        }
        if (!isSafeHttpUrl(payload.url)) {
            alert('Please enter a valid http/https URL');
            return;
        }

        try {
            let saved;
            if (editingLinkId) {
                saved = await projectsService.updateProjectLink(project.id, editingLinkId, payload);
                setProjectLinks((prev) => prev.map((link) => (link.id === editingLinkId ? saved : link)));
            } else {
                saved = await projectsService.createProjectLink(project.id, payload);
                setProjectLinks((prev) => [saved, ...prev]);
            }
            resetLinkForm();
        } catch (err) {
            alert(err.response?.data?.detail || err.message || 'Unable to save project link');
        }
    };

    const handleEditLink = (link) => {
        setEditingLinkId(link.id);
        setLinkForm({
            label: link.label || '',
            link_type: link.link_type || 'other',
            url: link.url || '',
        });
        setShowLinkForm(true);
    };

    const handleDeleteLink = async (linkId) => {
        const shouldDelete = window.confirm('Delete this project link?');
        if (!shouldDelete) return;

        try {
            await projectsService.deleteProjectLink(project.id, linkId);
            setProjectLinks((prev) => prev.filter((link) => link.id !== linkId));
        } catch (err) {
            alert(err.response?.data?.detail || err.message || 'Unable to delete project link');
        }
    };

    const handleCopyLink = async (url) => {
        try {
            await navigator.clipboard.writeText(url);
        } catch {
            window.prompt('Copy link:', url);
        }
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
                            style={{ padding: '16px', border: '1px solid var(--border-subtle)', borderRadius: '18px', background: 'var(--surface-card-strong)', cursor: 'pointer', position: 'relative' }}
                        >
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {Icon && <Icon size={14} color="var(--text-muted)" />}
                                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
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
                    <div className="saas-field">
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {Icon && <Icon size={14} color="var(--text-muted)" />}
                            <input 
                                type="text"
                                defaultValue={project[field] || ''}
                                onBlur={(e) => updateProjectFull(project.id, { [field]: e.target.value })}
                                style={{
                                    flex: 1,
                                    background: 'transparent',
                                    border: 'none',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    color: 'var(--text-primary)',
                                    outline: 'none',
                                    paddingBottom: '0'
                                }}
                            />
                        </div>
                    </div>
                );

                const SelectField = ({ label, field, options, icon: Icon }) => (
                    <div className="saas-field">
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {Icon && <Icon size={14} color="var(--text-muted)" />}
                            <select
                                value={
                                    field === 'board_stage'
                                        ? normalizeBoardStage(project[field])
                                        : field === 'priority'
                                            ? normalizeProjectPriority(project[field])
                                        : (project[field] || options[0] || '')
                                }
                                onChange={(event) => updateProjectFull(project.id, {
                                    [field]: field === 'priority' ? event.target.value.toLowerCase() : event.target.value,
                                })}
                                style={{
                                    flex: 1,
                                    background: 'var(--surface-card-strong)',
                                    border: 'none',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    color: 'var(--text-primary)',
                                    outline: 'none',
                                    cursor: 'pointer',
                                    borderRadius: '10px',
                                    colorScheme: theme === 'dark' ? 'dark' : 'light',
                                }}
                            >
                                {options.map((option) => (
                                    <option key={option} value={field === 'priority' ? option.toLowerCase() : option}>
                                        {field === 'status' ? formatProjectStatusLabel(option) : option}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                );

                return (
                    <>
                        <ProjectBrandAsset
                            project={project}
                            variant="hero"
                            style={{ width: '100%', height: '220px', marginBottom: '20px' }}
                        />

                        <div className="saas-detail-grid" style={{ marginBottom: '20px' }}>
                            <SelectField label="Project Status" field="status" options={PROJECT_STATUS_OPTIONS} />
                            <SelectField label="Priority" field="priority" options={PROJECT_PRIORITY_OPTIONS.map(formatProjectPriorityLabel)} />
                            {isExecutionProject ? (
                                <SelectField label="Execution Stage" field="board_stage" options={EXECUTION_BOARD_STAGES} />
                            ) : (
                                <div className="saas-field">
                                    <div className="saas-field__label">Execution Stage</div>
                                    <div className="saas-field__value">Available after project is won</div>
                                </div>
                            )}
                            <div className="saas-field">
                                <div className="saas-field__label">Current Version</div>
                                <div className="saas-field__value">{project.current_version || 'Not set'}</div>
                            </div>
                        </div>

                        {isExecutionProject ? (
                            <div className="project-card-section-shell" style={{ marginBottom: '20px' }}>
                                <ManagerAssignmentPlanner project={project} updateProjectFull={updateProjectFull} />
                            </div>
                        ) : null}

                        <div className="saas-surface project-card-section-shell" style={{ padding: '24px' }}>
                            <h3 style={{ fontSize: '15px', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)' }}>
                                <Clock size={18} color="var(--warning)" /> Event & Installation Timeline
                            </h3>
                            <div className="saas-detail-grid" style={{ gap: '20px' }}>
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

                        <div className="saas-surface" style={{ padding: '24px', marginTop: '20px' }}>
                            <div className="saas-section-heading" style={{ padding: 0, marginBottom: '16px' }}>
                                <div>
                                    <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Version History</h3>
                                    <p style={{ color: 'var(--text-muted)' }}>Track the revision chain and understand what changed without scanning freeform comments.</p>
                                </div>
                            </div>
                            {revisionHistory.length ? (
                                <div className="saas-version-timeline">
                                    {revisionHistory.map((entry, index) => (
                                        <div key={`${entry.version || 'version'}-${index}`} className="saas-version-item">
                                            <div className="saas-inline-meta">
                                                <span className="saas-badge saas-badge--status-in_progress saas-badge--sm">
                                                    {entry.version || `V${index + 1}`}
                                                </span>
                                                <span className="saas-page-note">
                                                    {entry.timestamp ? formatDateTimeDisplay(entry.timestamp) : 'Timestamp unavailable'}
                                                </span>
                                            </div>
                                            <strong style={{ color: 'var(--text-primary)' }}>
                                                {entry.notes || 'Revision recorded without notes'}
                                            </strong>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="saas-empty-state is-compact">
                                    <strong>No version history yet</strong>
                                    <span>Once versions are updated, the revision chain will appear here.</span>
                                </div>
                            )}
                        </div>
                    </>
                );

            case 'Materials':
                return (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>Materials Logistics</h3>
                        </div>
                        {/* Add material inputs */}
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: '8px', marginBottom: '16px' }}>
                            <input value={newMaterial.name} onChange={e => setNewMaterial({...newMaterial, name: e.target.value})} placeholder="Material Name" style={{ padding: '8px', border: '1px solid var(--bd)', borderRadius: '4px' }} />
                            <input value={newMaterial.quantity} onChange={e => setNewMaterial({...newMaterial, quantity: e.target.value})} placeholder="Qty" style={{ padding: '8px', border: '1px solid var(--bd)', borderRadius: '4px' }} />
                            <select value={newMaterial.status} onChange={e => setNewMaterial({...newMaterial, status: e.target.value})} style={{ padding: '8px', border: '1px solid var(--bd)', borderRadius: '4px', background: 'var(--surface-card-strong)', color: 'var(--text-primary)', colorScheme: theme === 'dark' ? 'dark' : 'light' }}>
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

            case 'Design':
                return (
                    <ProjectFileResourcePanel
                        projectId={project.id}
                        resourceType="design"
                        canManage={canManageTabData}
                        onResourceSaved={onProjectRefresh}
                    />
                );

            case 'AutoCAD':
                return <ProjectFileResourcePanel projectId={project.id} resourceType="autocad" canManage={canManageTabData} />;

            case 'Graphic File':
                return <ProjectFileResourcePanel projectId={project.id} resourceType="graphic_file" canManage={canManageTabData} />;

            case 'Photos':
                return (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>Project Photos & Execution</h3>
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

            case 'Checklist':
                return (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>Execution Checklist</h3>
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
                            {qcSteps.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: 'var(--tx3)' }}>No checklist steps defined.</div>}
                        </div>
                    </div>
                );

            default:
                return <div style={{ padding: '20px', textAlign: 'center', color: 'var(--tx3)' }}>Tab functionality coming soon.</div>;
        }
    };

    const tabContent = React.useMemo(
        () => renderTabContent(),
        [activeTab, canManageTabData, hoveredPhoto, isExecutionProject, newMaterial, newQcStep, onProjectRefresh, project, updateProjectFull]
    );

    if (!project) return null;

    return (
        <div className={`saas-modal ${theme}`}>
            <div className={`saas-modal__dialog${isFullscreen ? ' is-fullscreen' : ''}`}>
                <div className="saas-modal__header">
                    <div>
                        <div className="saas-eyebrow">
                            {getProjectCode(project)}
                        </div>
                        <h2 style={{ margin: '8px 0 0', fontSize: '24px', color: 'var(--text-primary)', lineHeight: 1.2, fontFamily: 'var(--font-display)' }}>
                            {project.project_name || 'Untitled project'}
                        </h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                            {project.event_name ? (
                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                    {project.event_name}
                                </span>
                            ) : null}
                            {project.area ? (
                                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                    {project.area}
                                </span>
                            ) : null}
                        </div>
                        <div className="saas-inline-meta" style={{ marginTop: '14px' }}>
                            <span className={`saas-badge saas-badge--status-${project.status || 'pending'}`}>
                                {formatProjectStatusLabel(project.status)}
                            </span>
                            <ProjectPriorityBadge priority={project.priority} />
                            {isExecutionProject ? (
                                <span style={{ padding: '6px 10px', background: 'rgba(15, 23, 42, 0.05)', color: 'var(--text-secondary)', fontSize: '11px', borderRadius: '999px', fontWeight: 700, border: '1px solid rgba(148, 163, 184, 0.16)' }}>
                                    {normalizeBoardStage(project.board_stage)}
                                </span>
                            ) : null}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <button
                            className="premium-icon-button"
                            onClick={() => setIsChatOpen(!isChatOpen)}
                            title={isChatOpen ? "Hide Chat" : "Show Chat"}
                            style={{ background: isChatOpen ? 'var(--warning-soft)' : undefined, color: isChatOpen ? 'var(--warning)' : 'var(--text-secondary)' }}
                        >
                            <MessageSquare size={20} />
                        </button>
                        <button className="premium-icon-button" onClick={() => setIsFullscreen(!isFullscreen)} title="Toggle Fullscreen" style={{ color: 'var(--text-secondary)' }}>
                            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                        </button>
                        <button className="premium-icon-button premium-icon-button--danger" onClick={onClose} title="Close Panel">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className="saas-modal__body">
                    <div className="saas-modal__main no-scrollbar">
                        <div className="saas-tabs" style={{ marginBottom: '20px' }}>
                            {['Details', 'Design', 'AutoCAD', 'Graphic File', 'Materials', 'Photos', 'Checklist'].map((tab) => (
                                <button key={tab} onClick={() => setActiveTab(tab)} className={activeTab === tab ? 'is-active' : ''}>
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {tabContent}

                    </div>

                    {isChatOpen && (
                        <div className="saas-modal__sidebar message-animate">
                            <div style={{ padding: '16px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
                                    <MessageSquare size={16} color="var(--warning)" /> Comments and activity
                                </div>
                            </div>

                            <div className="saas-comment-composer">
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

                        <div className="saas-comment-thread no-scrollbar">
                            {comments.map((c, idx) => (
                                <div key={idx} className="message-animate" style={{ display: 'flex', gap: '12px' }}>
                                    <div className="saas-comment__avatar" style={{ background: c.color || '#E0E7FF', color: c.textCol || '#4F46E5' }}>
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
