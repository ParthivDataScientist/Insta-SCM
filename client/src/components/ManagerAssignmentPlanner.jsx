import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarRange, CheckCircle2, Loader2, Plus, Users } from 'lucide-react';
import projectsService from '../api/projects';
import ManagerAvailabilityModal from './ManagerAvailabilityModal';
import {
    buildConflictWarningMessage,
    buildManagerAvailabilityGroups,
    getManagerAvailabilityResult,
    resolveProjectSchedule,
} from '../utils/managerScheduling';
import { formatDateRangeDisplay } from '../utils/dateUtils';

const sectionTitleStyle = {
    fontSize: '11px',
    fontWeight: 800,
    color: 'var(--tx3)',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
};

export default function ManagerAssignmentPlanner({ project, updateProjectFull }) {
    const queryClient = useQueryClient();
    const initialWindow = React.useMemo(() => resolveProjectSchedule(project), [project]);
    const [draft, setDraft] = React.useState({
        managerId: project?.manager_id ? String(project.manager_id) : '',
        startDate: initialWindow.start,
        endDate: initialWindow.end,
    });
    const [showAvailabilityModal, setShowAvailabilityModal] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);
    const [isEditing, setIsEditing] = React.useState(!project?.manager_id);
    const [showCreateManager, setShowCreateManager] = React.useState(false);
    const [newManagerName, setNewManagerName] = React.useState('');

    React.useEffect(() => {
        const nextWindow = resolveProjectSchedule(project);
        setDraft({
            managerId: project?.manager_id ? String(project.manager_id) : '',
            startDate: nextWindow.start,
            endDate: nextWindow.end,
        });
    }, [
        project?.allocation_end_date,
        project?.allocation_start_date,
        project?.dispatch_date,
        project?.dismantling_date,
        project?.event_end_date,
        project?.event_start_date,
        project?.id,
        project?.manager_id,
    ]);

    const { data: managers = [] } = useQuery({
        queryKey: ['managers_list'],
        queryFn: projectsService.fetchManagers,
        staleTime: 30000,
    });

    const createManagerMutation = useMutation({
        mutationFn: (data) => projectsService.createManager(data),
        onSuccess: async (createdManager) => {
            setDraft((current) => ({ ...current, managerId: String(createdManager.id) }));
            setNewManagerName('');
            setShowCreateManager(false);
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['managers_list'] }),
                queryClient.invalidateQueries({ queryKey: ['manager_timeline'] }),
                queryClient.invalidateQueries({ queryKey: ['projects'] }),
            ]);
        },
        onError: (error) => {
            window.alert(error.response?.data?.detail || error.message || 'Failed to create manager');
        },
    });

    const normalizedEndDate =
        draft.endDate && draft.endDate >= draft.startDate ? draft.endDate : draft.startDate;

    const availabilityQuery = useQuery({
        queryKey: ['manager_assignment_window', project?.id, draft.startDate, normalizedEndDate],
        queryFn: () =>
            projectsService.checkAvailability(
                draft.startDate,
                normalizedEndDate || draft.startDate,
                null,
                project?.id || null
            ),
        enabled: Boolean(draft.startDate),
        staleTime: 5000,
    });

    const availabilityMap = availabilityQuery.data || {};
    const selectedManager = React.useMemo(
        () => managers.find((manager) => String(manager.id) === String(draft.managerId)) || null,
        [draft.managerId, managers]
    );
    const selectedAvailability = React.useMemo(
        () => getManagerAvailabilityResult(availabilityMap, selectedManager?.id),
        [availabilityMap, selectedManager]
    );
    const { availableManagers, busyManagers } = React.useMemo(
        () => buildManagerAvailabilityGroups(managers, availabilityMap),
        [managers, availabilityMap]
    );

    const hasChanges =
        String(project?.manager_id || '') !== String(draft.managerId || '') ||
        (initialWindow.start || '') !== (draft.startDate || '') ||
        (initialWindow.end || '') !== (normalizedEndDate || '');

    const saveSchedule = async () => {
        if (!hasChanges) {
            setIsEditing(false);
            return;
        }

        if (draft.managerId && !draft.startDate) {
            window.alert('Set the project date window before assigning a manager.');
            return;
        }

        if (selectedAvailability && !selectedAvailability.available) {
            const shouldProceed = window.confirm(
                buildConflictWarningMessage(
                    selectedManager?.full_name,
                    selectedAvailability.conflicts,
                    draft.startDate,
                    normalizedEndDate
                )
            );
            if (!shouldProceed) {
                return;
            }
        }

        setIsSaving(true);
        try {
            await updateProjectFull(project.id, {
                manager_id: draft.managerId ? Number(draft.managerId) : null,
                allocation_start_date: draft.startDate || null,
                allocation_end_date: normalizedEndDate || null,
            });
            setIsEditing(false);
        } catch (err) {
            console.error("Failed to save assignment:", err);
            window.alert("Failed to save assignment. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const selectionTone = !draft.managerId
        ? { color: 'var(--tx3)', background: 'var(--bg-in)', border: 'var(--bd)' }
        : selectedAvailability?.available === false
            ? { color: 'var(--red)', background: 'var(--red-ghost)', border: 'var(--red-glow)' }
            : { color: 'var(--green)', background: 'var(--green-ghost)', border: 'var(--green-glow)' };

    const renderManagerRow = (entry, isBusy = false) => {
        const isSelected = String(entry.manager.id) === String(draft.managerId);
        const firstConflict = entry.conflicts?.[0];
        const firstConflictStart =
            firstConflict?.allocation_start_date ||
            firstConflict?.dispatch_date ||
            firstConflict?.event_start_date;
        const firstConflictEnd =
            firstConflict?.allocation_end_date ||
            firstConflict?.dismantling_date ||
            firstConflict?.event_end_date ||
            firstConflictStart;

        return (
            <button
                key={entry.manager.id}
                type="button"
                onClick={() => setDraft((current) => ({ ...current, managerId: String(entry.manager.id) }))}
                style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '14px 16px',
                    borderRadius: '18px',
                    border: `1px solid ${isSelected ? 'var(--accent-border)' : isBusy ? 'var(--red-glow)' : 'var(--bd)'}`,
                    background: isSelected ? 'var(--accent-soft)' : isBusy ? 'var(--red-ghost)' : 'var(--bg-card)',
                    display: 'grid',
                    gap: '8px',
                    transition: 'transform 0.18s ease, border-color 0.18s ease, background 0.18s ease',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--tx)' }}>
                        {entry.manager.full_name}
                    </div>
                    <div
                        style={{
                            padding: '4px 8px',
                            borderRadius: '999px',
                            fontSize: '10px',
                            fontWeight: 800,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            background: isBusy ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                            color: isBusy ? 'var(--red)' : 'var(--green)',
                        }}
                    >
                        {isSelected ? 'Selected' : isBusy ? 'Busy' : 'Available'}
                    </div>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--tx2)', lineHeight: 1.45 }}>
                    {isBusy
                        ? `${entry.conflicts.length} conflict${entry.conflicts.length === 1 ? '' : 's'} in this window`
                        : 'Free for the requested project window'}
                </div>

                {isBusy && firstConflict ? (
                    <div style={{ fontSize: '12px', color: 'var(--tx3)', lineHeight: 1.45 }}>
                        {firstConflict.project_name} - {formatDateRangeDisplay(firstConflictStart, firstConflictEnd)}
                    </div>
                ) : null}
            </button>
        );
    };

    if (!isEditing) {
        return (
            <div style={{
                padding: '24px',
                border: '1px solid var(--bd)',
                borderRadius: '24px',
                background: 'var(--bg-card)',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--tx3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                            Manager Assignment
                        </div>
                        <div style={{ marginTop: '8px', fontSize: '19px', fontWeight: 800, color: 'var(--tx)' }}>
                            {selectedManager?.full_name || 'Unassigned'}
                        </div>
                        {draft.startDate && (
                            <div style={{ marginTop: '6px', fontSize: '13px', color: 'var(--tx3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <CalendarRange size={14} />
                                {formatDateRangeDisplay(draft.startDate, normalizedEndDate)}
                            </div>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="premium-action-button"
                    >
                        Edit Assignment
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            <div
                style={{
                    padding: '24px',
                    border: '1px solid var(--bd)',
                    borderRadius: '24px',
                    background: 'var(--bg-card)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '18px',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--tx3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                            Manager Assignment
                        </div>
                        <div style={{ marginTop: '8px', fontSize: '19px', fontWeight: 800, color: 'var(--tx)' }}>
                            {selectedManager?.full_name || 'Unassigned'}
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginLeft: 'auto' }}>
                        <button
                            type="button"
                            className="premium-action-button"
                            onClick={() => setShowCreateManager((open) => !open)}
                        >
                            <Plus size={14} />
                            {showCreateManager ? 'Hide manager form' : 'Add manager'}
                        </button>
                        <div
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 12px',
                                borderRadius: '999px',
                                background: selectionTone.background,
                                color: selectionTone.color,
                                border: `1px solid ${selectionTone.border}`,
                                fontSize: '12px',
                                fontWeight: 700,
                            }}
                        >
                            {availabilityQuery.isLoading ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : selectedAvailability?.available === false ? (
                                <AlertTriangle size={14} />
                            ) : (
                                <CheckCircle2 size={14} />
                            )}
                            {!draft.managerId
                                ? 'No manager selected'
                                : selectedAvailability?.available === false
                                    ? 'Selected manager has conflicts'
                                    : 'Selected manager is available'}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                    <label className="premium-filter" style={{ minWidth: 0 }}>
                        <Users size={14} color="var(--tx3)" />
                        <select
                            value={draft.managerId}
                            onChange={(event) => setDraft((current) => ({ ...current, managerId: event.target.value }))}
                        >
                            <option value="">Unassigned</option>
                            {managers.map((manager) => (
                                <option key={manager.id} value={String(manager.id)}>
                                    {manager.full_name}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
                        <button
                            type="button"
                            className="premium-action-button"
                            style={{ flex: 1, justifyContent: 'space-between', marginLeft: 'auto' }}
                            disabled={!selectedManager}
                            onClick={() => setShowAvailabilityModal(true)}
                        >
                            <Users size={14} />
                            Overview
                        </button>
                    </div>
                </div>

                {showCreateManager ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '12px', alignItems: 'center', padding: '14px 16px', borderRadius: '18px', border: '1px solid var(--bd)', background: 'var(--bg-ralt)' }}>
                        <label className="premium-filter" style={{ minWidth: 0 }}>
                            <Plus size={14} color="var(--tx3)" />
                            <input
                                type="text"
                                placeholder="Create a new manager"
                                value={newManagerName}
                                onChange={(event) => setNewManagerName(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        createManagerMutation.mutate({ name: newManagerName });
                                    }
                                }}
                            />
                        </label>

                        <button
                            type="button"
                            className="premium-action-button premium-action-button--primary"
                            disabled={createManagerMutation.isPending}
                            onClick={() => createManagerMutation.mutate({ name: newManagerName })}
                        >
                            {createManagerMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                            Save manager
                        </button>
                    </div>
                ) : null}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                    <label className="premium-filter" style={{ minWidth: 0 }}>
                        <CalendarRange size={14} color="var(--tx3)" />
                        <input
                            type="date"
                            value={draft.startDate}
                            onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))}
                        />
                    </label>

                    <label className="premium-filter" style={{ minWidth: 0 }}>
                        <CalendarRange size={14} color="var(--tx3)" />
                        <input
                            type="date"
                            value={normalizedEndDate}
                            onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))}
                        />
                    </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }}>
                    <div style={{ padding: '14px 16px', borderRadius: '18px', background: 'var(--bg-ralt)', border: '1px solid var(--bd)' }}>
                        <div style={sectionTitleStyle}>Selected manager</div>
                        <div style={{ marginTop: '8px', fontSize: '16px', fontWeight: 700, color: 'var(--tx)' }}>
                            {selectedManager?.full_name || 'Unassigned'}
                        </div>
                    </div>
                    <button
                        type="button"
                        className="premium-action-button"
                        onClick={() => setDraft((current) => ({ ...current, managerId: '' }))}
                    >
                        Clear
                    </button>
                </div>

                {draft.startDate ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px' }}>
                        <div className="project-card-section-shell" style={{ padding: '16px', borderRadius: '20px', borderColor: 'color-mix(in srgb, var(--green) 20%, var(--bd))', background: 'color-mix(in srgb, var(--green-ghost) 44%, var(--surface-card-strong))', display: 'grid', gap: '12px' }}>
                            <div>
                                <div style={{ ...sectionTitleStyle, color: 'var(--green)' }}>Available managers</div>
                                <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--tx3)' }}>
                                    {availabilityQuery.isLoading ? 'Checking live availability...' : `${availableManagers.length} manager${availableManagers.length === 1 ? '' : 's'} free in this window`}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gap: '10px', maxHeight: '280px', overflow: 'auto', paddingRight: '2px' }}>
                                {availabilityQuery.isLoading ? (
                                    <div style={{ padding: '18px', borderRadius: '18px', border: '1px dashed var(--bd)', color: 'var(--tx3)', textAlign: 'center' }}>
                                        Loading available managers...
                                    </div>
                                ) : availableManagers.length === 0 ? (
                                    <div style={{ padding: '18px', borderRadius: '18px', border: '1px dashed var(--bd)', color: 'var(--tx3)', textAlign: 'center' }}>
                                        No free managers found for this period.
                                    </div>
                                ) : (
                                    availableManagers.map((entry) => renderManagerRow(entry))
                                )}
                            </div>
                        </div>

                        <div className="project-card-section-shell" style={{ padding: '16px', borderRadius: '20px', borderColor: 'color-mix(in srgb, var(--red) 18%, var(--bd))', background: 'color-mix(in srgb, var(--red-ghost) 52%, var(--surface-card-strong))', display: 'grid', gap: '12px' }}>
                            <div>
                                <div style={{ ...sectionTitleStyle, color: 'var(--red)' }}>Busy managers</div>
                                <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--tx3)' }}>
                                    {availabilityQuery.isLoading ? 'Reviewing overlaps...' : `${busyManagers.length} manager${busyManagers.length === 1 ? '' : 's'} already occupied in this window`}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gap: '10px', maxHeight: '280px', overflow: 'auto', paddingRight: '2px' }}>
                                {availabilityQuery.isLoading ? (
                                    <div style={{ padding: '18px', borderRadius: '18px', border: '1px dashed var(--bd)', color: 'var(--tx3)', textAlign: 'center' }}>
                                        Loading busy managers...
                                    </div>
                                ) : busyManagers.length === 0 ? (
                                    <div style={{ padding: '18px', borderRadius: '18px', border: '1px dashed var(--bd)', color: 'var(--tx3)', textAlign: 'center' }}>
                                        No conflicts found. Everyone is free.
                                    </div>
                                ) : (
                                    busyManagers.map((entry) => renderManagerRow(entry, true))
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{ padding: '18px', borderRadius: '18px', border: '1px dashed var(--bd)', color: 'var(--tx3)', textAlign: 'center', background: 'var(--bg-ralt)' }}>
                        Choose a start and end date to see all available and busy managers for that period.
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        className="premium-action-button"
                        onClick={() => {
                            setDraft({
                                managerId: project?.manager_id ? String(project.manager_id) : '',
                                startDate: initialWindow.start,
                                endDate: initialWindow.end,
                            });
                            if (project?.manager_id) setIsEditing(false);
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="premium-action-button premium-action-button--primary"
                        onClick={saveSchedule}
                        disabled={isSaving}
                    >
                        {isSaving ? <Loader2 size={14} className="animate-spin" /> : <CalendarRange size={14} />}
                        Save assignment
                    </button>
                </div>
            </div>

            {showAvailabilityModal && selectedManager ? (
                <ManagerAvailabilityModal
                    managerId={selectedManager.id}
                    managerName={selectedManager.full_name}
                    onClose={() => setShowAvailabilityModal(false)}
                />
            ) : null}
        </>
    );
}
