import React from 'react';
import { AlertTriangle, Copy, Download, ExternalLink, FileUp, Link as LinkIcon, Plus, Save, Trash2 } from 'lucide-react';
import projectsService from '../api/projects';
import { formatDateTimeDisplay } from '../utils/dateUtils';
import AlertBanner from './AlertBanner';
import EmptyState from './EmptyState';

const RESOURCE_META = {
    design: {
        title: 'Design Files',
        description: 'Upload or link concept decks, reference sheets, and revision packs.',
        accent: '#2563EB',
        tint: 'rgba(37, 99, 235, 0.10)',
    },
    autocad: {
        title: 'AutoCAD Files',
        description: 'Track CAD drawings and technical layout versions without overwriting history.',
        accent: '#C8792B',
        tint: 'rgba(200, 121, 43, 0.12)',
    },
    graphic_file: {
        title: 'Graphic Files',
        description: 'Manage print-ready artwork, branding kits, and handoff packages.',
        accent: '#238A5D',
        tint: 'rgba(35, 138, 93, 0.12)',
    },
};

const EMPTY_FORM = {
    entry_key: null,
    label: '',
    source_type: 'link',
    url: '',
    file_name: '',
    file_content: '',
    mime_type: '',
};

const isSafeHttpUrl = (value) => {
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
};

const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Unable to read file'));
        reader.readAsDataURL(file);
    });

export default function ProjectFileResourcePanel({ projectId, resourceType, canManage = false, onResourceSaved = null }) {
    const [entries, setEntries] = React.useState([]);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState('');
    const [showForm, setShowForm] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [form, setForm] = React.useState(EMPTY_FORM);

    const meta = RESOURCE_META[resourceType] || RESOURCE_META.design;

    const loadEntries = React.useCallback(async () => {
        if (!projectId) return;

        setLoading(true);
        setError('');
        try {
            const data = await projectsService.fetchProjectResources(projectId, resourceType);
            setEntries(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.response?.data?.detail || err.message || 'Unable to load project resources');
        } finally {
            setLoading(false);
        }
    }, [projectId, resourceType]);

    React.useEffect(() => {
        setEntries([]);
        setError('');
        setShowForm(false);
        setForm(EMPTY_FORM);
    }, [projectId, resourceType]);

    React.useEffect(() => {
        loadEntries();
    }, [loadEntries]);

    const openNewEntryForm = () => {
        setForm(EMPTY_FORM);
        setShowForm(true);
    };

    const openNewVersionForm = (entry) => {
        setForm({
            ...EMPTY_FORM,
            entry_key: entry.entry_key,
            label: entry.label,
            source_type: entry.versions?.[entry.versions.length - 1]?.source_type || 'link',
        });
        setShowForm(true);
    };

    const resetForm = () => {
        setShowForm(false);
        setForm(EMPTY_FORM);
    };

    const handleFileChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const fileContent = await readFileAsDataUrl(file);
            setForm((current) => ({
                ...current,
                file_name: file.name,
                file_content: fileContent,
                mime_type: file.type || 'application/octet-stream',
            }));
        } catch (err) {
            window.alert(err.message || 'Unable to read file');
        } finally {
            event.target.value = '';
        }
    };

    const handleSave = async () => {
        const payload = {
            entry_key: form.entry_key || undefined,
            label: form.label.trim(),
            source_type: form.source_type,
        };

        if (!payload.label) {
            window.alert('Resource label is required');
            return;
        }

        if (payload.source_type === 'link') {
            if (!isSafeHttpUrl(form.url.trim())) {
                window.alert('Please enter a valid http/https URL');
                return;
            }
            payload.url = form.url.trim();
        } else {
            if (!form.file_name || !form.file_content) {
                window.alert('Choose a file before saving');
                return;
            }
            payload.file_name = form.file_name;
            payload.file_content = form.file_content;
            payload.mime_type = form.mime_type || undefined;
        }

        setSaving(true);
        try {
            const savedEntry = await projectsService.createProjectResource(projectId, resourceType, payload);
            setEntries((current) => {
                const remaining = current.filter((entry) => entry.entry_key !== savedEntry.entry_key);
                return [savedEntry, ...remaining];
            });
            await onResourceSaved?.();
            resetForm();
        } catch (err) {
            window.alert(err.response?.data?.detail || err.message || 'Unable to save project resource');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteVersion = async (versionId) => {
        if (!window.confirm('Delete this version from the history?')) return;

        try {
            await projectsService.deleteProjectResource(projectId, versionId);
            await loadEntries();
            await onResourceSaved?.();
        } catch (err) {
            window.alert(err.response?.data?.detail || err.message || 'Unable to delete project resource');
        }
    };

    const handleCopy = async (value) => {
        try {
            await navigator.clipboard.writeText(value);
        } catch {
            window.prompt('Copy this value:', value);
        }
    };

    return (
        <div className="saas-resource-stack">
            <div className="saas-section-heading" style={{ padding: 0 }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '16px' }}>{meta.title}</h3>
                    <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--tx3)' }}>
                        {meta.description}
                    </p>
                </div>

                {canManage ? (
                    <button
                        type="button"
                        onClick={openNewEntryForm}
                        className="saas-button saas-button--primary"
                    >
                        <Plus size={16} />
                        Add Entry
                    </button>
                ) : null}
            </div>

            {showForm ? (
                <div className="saas-surface" style={{ padding: '18px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1.5fr auto', gap: '12px', alignItems: 'end' }}>
                        <div>
                            <div style={{ fontSize: '11px', color: 'var(--tx3)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>Label</div>
                            <input
                                value={form.label}
                                onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                                placeholder="Main design pack"
                                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--bd)', borderRadius: '10px', background: 'var(--bg-card)', color: 'var(--tx)' }}
                            />
                        </div>

                        <div>
                            <div style={{ fontSize: '11px', color: 'var(--tx3)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>Source</div>
                            <select
                                value={form.source_type}
                                onChange={(event) => setForm((current) => ({ ...current, source_type: event.target.value, url: '', file_name: '', file_content: '', mime_type: '' }))}
                                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--bd)', borderRadius: '10px', background: 'var(--bg-card)', color: 'var(--tx)' }}
                            >
                                <option value="link">Link</option>
                                <option value="file">File</option>
                            </select>
                        </div>

                        <div>
                            <div style={{ fontSize: '11px', color: 'var(--tx3)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>
                                {form.source_type === 'link' ? 'URL' : 'File'}
                            </div>
                            {form.source_type === 'link' ? (
                                <input
                                    value={form.url}
                                    onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))}
                                    placeholder="https://..."
                                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--bd)', borderRadius: '10px', background: 'var(--bg-card)', color: 'var(--tx)' }}
                                />
                            ) : (
                                <label
                                    style={{
                                        width: '100%',
                                        minHeight: '42px',
                                        border: '1px dashed var(--bd)',
                                        borderRadius: '10px',
                                        background: 'var(--bg-card)',
                                        color: 'var(--tx2)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '10px',
                                        padding: '10px 12px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {form.file_name || 'Choose a file'}
                                    </span>
                                    <FileUp size={15} />
                                    <input type="file" style={{ display: 'none' }} onChange={handleFileChange} />
                                </label>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving}
                                className="saas-button saas-button--primary"
                            >
                                <Save size={15} />
                                {saving ? 'Saving' : 'Save'}
                            </button>
                            <button
                                type="button"
                                onClick={resetForm}
                                className="saas-button saas-button--ghost"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            <AlertBanner message={error} />

            {loading ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--tx3)' }}>Loading version history...</div>
            ) : entries.length === 0 ? (
                <EmptyState title="No resources added yet" description="Add the first version to start a clear file history for this tab." compact />
            ) : (
                <div className="saas-resource-stack">
                    {entries.map((entry) => (
                        <div key={entry.entry_key} className="saas-resource-entry">
                            <div className="saas-resource-entry__header" style={{ background: meta.tint }}>
                                <div>
                                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--tx)' }}>{entry.label}</div>
                                    <div style={{ marginTop: '6px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span style={{ padding: '4px 8px', borderRadius: '999px', background: 'var(--surface-card-strong)', color: meta.accent, fontSize: '10px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', border: '1px solid var(--border-subtle)' }}>
                                            {entry.latest_version}
                                        </span>
                                        <span style={{ fontSize: '12px', color: 'var(--tx3)' }}>
                                            {entry.version_count} version{entry.version_count === 1 ? '' : 's'}
                                        </span>
                                    </div>
                                </div>

                                {canManage ? (
                                    <button
                                        type="button"
                                        onClick={() => openNewVersionForm(entry)}
                                        className="saas-button"
                                        style={{ background: 'var(--surface-card-strong)', color: meta.accent, borderColor: 'var(--border-subtle)' }}
                                    >
                                        <Plus size={14} />
                                        New Version
                                    </button>
                                ) : null}
                            </div>

                            <div className="saas-resource-entry__versions">
                                {entry.versions.map((version) => {
                                    const isLink = version.source_type === 'link';
                                    const href = isLink ? version.url : version.file_content;
                                    const hasTarget = Boolean(href);
                                    return (
                                        <div key={version.id} className="saas-resource-version">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                        <span style={{ padding: '4px 8px', borderRadius: '999px', background: 'var(--bg-card)', color: meta.accent, fontSize: '10px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', border: '1px solid var(--bd)' }}>
                                                            {version.version_label}
                                                        </span>
                                                        <span style={{ fontSize: '12px', color: 'var(--tx3)' }}>
                                                            {formatDateTimeDisplay(version.created_at)}
                                                        </span>
                                                    </div>

                                                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--tx2)', fontSize: '13px', minWidth: 0 }}>
                                                        {isLink ? <LinkIcon size={14} /> : <FileUp size={14} />}
                                                        <span style={{ fontWeight: 600, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {isLink ? (version.url || 'Missing link') : (version.file_name || 'Uploaded file')}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                    {isLink && version.url ? (
                                                        <button type="button" onClick={() => handleCopy(version.url)} className="saas-button saas-button--ghost">
                                                            <Copy size={14} />
                                                            Copy
                                                        </button>
                                                    ) : null}

                                                    {hasTarget ? (
                                                        isLink ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => window.open(version.url, '_blank', 'noopener,noreferrer')}
                                                                className="saas-button saas-button--primary"
                                                            >
                                                                <ExternalLink size={14} />
                                                                Open
                                                            </button>
                                                        ) : (
                                                            <a
                                                                href={version.file_content}
                                                                download={version.file_name || `${entry.label}-${version.version_label}`}
                                                                className="saas-button saas-button--primary"
                                                                style={{ textDecoration: 'none' }}
                                                            >
                                                                <Download size={14} />
                                                                Download
                                                            </a>
                                                        )
                                                    ) : (
                                                        <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.14)', color: '#B45309', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '12px' }}>
                                                            <AlertTriangle size={14} />
                                                            Missing source
                                                        </div>
                                                    )}

                                                    {canManage ? (
                                                        <button type="button" onClick={() => handleDeleteVersion(version.id)} className="saas-button saas-button--danger">
                                                            <Trash2 size={14} />
                                                            Delete
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
