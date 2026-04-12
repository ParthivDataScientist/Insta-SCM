import React, { Suspense, lazy, useDeferredValue, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Briefcase, CalendarRange, ChevronLeft, ChevronRight, Layout, MapPin, RefreshCw, Search, UserPlus, Users, X } from 'lucide-react';
import { useGlobalDateRange } from '../contexts/GlobalDateRangeContext';
import projectsService from '../api/projects';
import AppShell from '../components/app/AppShell';
import AlertBanner from '../components/AlertBanner';
import EmptyState from '../components/EmptyState';
import GlobalDateRangePicker from '../components/GlobalDateRangePicker';
import ProjectPriorityBadge from '../components/ProjectPriorityBadge';
import KpiCard from '../components/app/KpiCard';
import { EXECUTION_BOARD_STAGES, formatProjectStatusLabel, normalizeBoardStage, normalizeProjectPriority, sortProjectsByPriority } from '../utils/projectStatus';
import { formatDateDisplay, formatDateRangeDisplay } from '../utils/dateUtils';
import { usePersistentState } from '../hooks/usePersistentState';

const ProjectBoardModal = lazy(() => import('../components/ProjectBoardModal'));
const VIEW_MODES = ['Day', 'Week', 'Month'];

const getManagerName = (row) => (typeof row.manager === 'string' ? row.manager : (row.manager?.full_name || row.manager?.name || 'Unknown'));
const getManagerId = (row) => (typeof row.manager === 'string' ? null : (row.manager?.id ?? null));
const getAllocations = (row) => (row.allocations || row.projects || []).map((item) => item.project || item);

const getSchedule = (project) => {
    const start = project.dispatch_date || project.allocation_start_date || project.installation_start_date || project.event_start_date;
    const end = project.dismantling_date || project.allocation_end_date || project.installation_end_date || project.event_end_date || start;
    return { start, end };
};

const getWorkload = (count) => {
    if (count >= 4) return { label: 'Fully booked', tone: 'red', progress: '100%' };
    if (count >= 2) return { label: 'Partially booked', tone: 'amber', progress: '66%' };
    return { label: 'Available', tone: 'green', progress: count ? '34%' : '14%' };
};

const makeDragPreview = (project) => {
    const preview = document.createElement('div');
    preview.className = 'officer-drag-preview';
    preview.innerHTML = `<strong>${project.project_name || 'Untitled project'}</strong><span>${project.branch || project.venue || 'Project reassignment'}</span>`;
    document.body.appendChild(preview);
    return preview;
};

const ProjectCard = React.memo(function ProjectCard({ project, compact, draggingId, onOpen, onStageChange, onDragStart, onDragEnd }) {
    const { start, end } = getSchedule(project);
    const priority = normalizeProjectPriority(project.priority);

    return (
        <motion.button
            type="button"
            layout
            draggable
            className={`officer-card saas-priority-cell saas-priority-cell--${priority}${draggingId === project.id ? ' is-dragging' : ''}`}
            onDragStart={(event) => onDragStart(event, project)}
            onDragEnd={onDragEnd}
            onClick={() => onOpen(project)}
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ scale: 0.985 }}
        >
            <div className="officer-card__top">
                <div>
                    <div className="officer-card__eyebrow">{project.crm_project_id || `PRJ-${String(project.id).padStart(5, '0')}`}</div>
                    <div className="officer-card__title">{project.project_name || 'Untitled project'}</div>
                </div>
                <ProjectPriorityBadge priority={priority} size="sm" />
            </div>
            <div className="saas-inline-meta">
                <span className={`saas-badge saas-badge--status-${project.status || 'pending'} saas-badge--sm`}>
                    {formatProjectStatusLabel(project.status)}
                </span>
            </div>
            {!compact && project.event_name ? <div className="officer-card__meta">{project.event_name}</div> : null}
            <div className="officer-card__facts">
                <div><CalendarRange size={14} /><span>{start ? formatDateRangeDisplay(start, end) : 'Dates not set'}</span></div>
                <div><MapPin size={14} /><span>{project.branch || project.venue || 'Location pending'}</span></div>
            </div>
            <div className="officer-card__footer">
                <label className="premium-filter officer-card__stage" onClick={(event) => event.stopPropagation()}>
                    <Layout size={14} color="var(--tx3)" />
                    <select value={normalizeBoardStage(project.board_stage)} onChange={(event) => onStageChange(project.id, event.target.value)}>
                        {EXECUTION_BOARD_STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                    </select>
                </label>
                <span className="officer-card__updated">{project.updated_at ? `Updated ${formatDateDisplay(project.updated_at)}` : 'Recently synced'}</span>
            </div>
        </motion.button>
    );
});

const ManagerColumn = React.memo(function ManagerColumn({ column, viewMode, dropTarget, setDropTarget, onDropProject, draggingId, onOpen, onStageChange, onDragStart, onDragEnd }) {
    const workload = getWorkload(column.projects.length);
    const dropKey = `manager-${column.key}`;
    const compact = viewMode === 'Day';

    return (
        <motion.section
            layout
            className={`officer-column${dropTarget === dropKey ? ' is-drop-target' : ''}`}
            style={{ width: compact ? '292px' : viewMode === 'Week' ? '336px' : '376px' }}
            onDragOver={(event) => { event.preventDefault(); setDropTarget(dropKey); }}
            onDragLeave={() => setDropTarget((current) => current === dropKey ? null : current)}
            onDrop={(event) => {
                event.preventDefault();
                const projectId = Number(event.dataTransfer.getData('projectId'));
                if (projectId) onDropProject(projectId, column.managerId);
            }}
        >
            <div className="officer-column__header">
                <div>
                    <div className="officer-column__label">Manager</div>
                    <div className="officer-column__name">{column.managerName}</div>
                </div>
                <div className="officer-column__count">{column.projects.length}</div>
            </div>
            <div className="officer-column__workload">
                <div className={`officer-workload officer-workload--${workload.tone}`}>
                    <span className="officer-workload__dot" />
                    {workload.label}
                </div>
                <div className="officer-column__meter"><div className={`officer-column__meter-fill officer-column__meter-fill--${workload.tone}`} style={{ width: workload.progress }} /></div>
            </div>
            <div className="officer-column__body">
                <AnimatePresence mode="popLayout">
                    {column.projects.length === 0 ? (
                        <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="officer-empty-state officer-empty-state--column">
                            No assignments yet.
                            <span>Drag a project here to assign this manager.</span>
                        </motion.div>
                    ) : column.projects.map((project) => (
                        <ProjectCard
                            key={project.id}
                            project={project}
                            compact={compact}
                            draggingId={draggingId}
                            onOpen={onOpen}
                            onStageChange={onStageChange}
                            onDragStart={onDragStart}
                            onDragEnd={onDragEnd}
                        />
                    ))}
                </AnimatePresence>
            </div>
        </motion.section>
    );
});

export default function ManagerTimelinePremium() {
    const queryClient = useQueryClient();
    const { dateRange } = useGlobalDateRange();
    const [searchQuery, setSearchQuery] = usePersistentState('insta.officer.searchQuery', '');
    const deferredSearch = useDeferredValue(searchQuery);
    const [filterManager, setFilterManager] = usePersistentState('insta.officer.filterManager', 'All');
    const [filterStage, setFilterStage] = usePersistentState('insta.officer.filterStage', 'All');
    const [filterBranch, setFilterBranch] = usePersistentState('insta.officer.filterBranch', 'All');
    const [filterPriority, setFilterPriority] = usePersistentState('insta.officer.filterPriority', 'All');
    const [viewMode, setViewMode] = usePersistentState('insta.officer.viewMode', 'Week');
    const [selectedProject, setSelectedProject] = useState(null);
    const [showAddManager, setShowAddManager] = useState(false);
    const [newManagerName, setNewManagerName] = useState('');
    const [dropTarget, setDropTarget] = useState(null);
    const [draggingProjectId, setDraggingProjectId] = useState(null);
    const [collapsedPanel, setCollapsedPanel] = useState(false);

    const { data: timelineData = [], isLoading, isFetching, refetch, error: timelineError } = useQuery({ queryKey: ['manager_timeline'], queryFn: projectsService.fetchTimeline, staleTime: 10000 });
    const { data: projectsData = [] } = useQuery({
        queryKey: ['projects', { date_context: 'execution', start_date: dateRange.start || undefined, end_date: dateRange.end || undefined }],
        queryFn: () => projectsService.fetchProjects({ start_date: dateRange.start || undefined, end_date: dateRange.end || undefined, date_context: 'execution' }),
        staleTime: 10000,
    });

    const refreshBoard = async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['manager_timeline'] }),
            queryClient.invalidateQueries({ queryKey: ['projects'] }),
            queryClient.invalidateQueries({ queryKey: ['projectStats'] }),
            queryClient.invalidateQueries({ queryKey: ['managers_list'] }),
        ]);
        await refetch();
    };

    const createManagerMutation = useMutation({
        mutationFn: (payload) => projectsService.createManager(payload),
        onSuccess: async () => { setNewManagerName(''); setShowAddManager(false); await refreshBoard(); },
        onError: (error) => window.alert(error.response?.data?.detail || error.message || 'Failed to create manager'),
    });
    const updateProjectMutation = useMutation({
        mutationFn: ({ id, data }) => projectsService.updateProject(id, data),
        onSuccess: refreshBoard,
        onError: (error) => window.alert(error.response?.data?.detail || error.message || 'Failed to update project'),
    });

    const inRange = (project) => {
        if (!dateRange.start && !dateRange.end) return true;
        const value = project?.event_start_date || project?.dispatch_date || project?.allocation_start_date;
        if (!value) return false;
        const date = new Date(value);
        if (dateRange.start && date < new Date(dateRange.start)) return false;
        if (dateRange.end && date > new Date(dateRange.end)) return false;
        return true;
    };

    const columns = useMemo(() => {
        const query = deferredSearch.trim().toLowerCase();
        return timelineData.map((row) => {
            const managerName = getManagerName(row);
            const projects = getAllocations(row).filter((project) => {
                if (!inRange(project)) return false;
                if (filterStage !== 'All' && normalizeBoardStage(project.board_stage) !== filterStage) return false;
                if (filterBranch !== 'All' && (project.branch || '') !== filterBranch) return false;
                if (filterPriority !== 'All' && normalizeProjectPriority(project.priority) !== filterPriority.toLowerCase()) return false;
                if (!query) return true;
                return [managerName, project.project_name, project.event_name, project.branch, project.venue].filter(Boolean).some((value) => value.toLowerCase().includes(query));
            }).sort(sortProjectsByPriority);
            const managerMatch = !query || managerName.toLowerCase().includes(query) || projects.length > 0;
            if (!managerMatch) return null;
            if (filterManager !== 'All' && managerName !== filterManager) return null;
            return { key: getManagerId(row) ?? managerName, managerId: getManagerId(row), managerName, projects, isUnassigned: managerName === 'Unassigned' };
        }).filter(Boolean);
    }, [deferredSearch, filterBranch, filterManager, filterPriority, filterStage, timelineData, dateRange.start, dateRange.end]);

    const managerColumns = columns.filter((column) => !column.isUnassigned);
    const unassignedProjects = columns.find((column) => column.isUnassigned)?.projects || [];
    const uniqueManagers = useMemo(() => ['All', ...new Set(timelineData.map((row) => getManagerName(row)).filter((name) => name && name !== 'Unassigned'))].sort(), [timelineData]);
    const uniqueBranches = useMemo(() => ['All', ...new Set(projectsData.map((project) => project.branch).filter(Boolean))].sort(), [projectsData]);
    const summary = useMemo(() => ({
        managers: managerColumns.length,
        assigned: managerColumns.reduce((count, column) => count + column.projects.length, 0),
        urgent: managerColumns.reduce((count, column) => count + column.projects.filter((project) => normalizeProjectPriority(project.priority) === 'high').length, 0),
        partial: managerColumns.filter((column) => column.projects.length >= 2 && column.projects.length < 4).length,
        full: managerColumns.filter((column) => column.projects.length >= 4).length,
    }), [managerColumns]);
    const modalProject = useMemo(() => !selectedProject ? null : (projectsData.find((project) => project.id === selectedProject.id) || selectedProject), [projectsData, selectedProject]);

    const handleDropProject = async (projectId, managerId) => {
        await updateProjectMutation.mutateAsync({ id: projectId, data: { manager_id: managerId } });
        setDropTarget(null);
        setDraggingProjectId(null);
    };
    const handleStageChange = async (projectId, stage) => updateProjectMutation.mutateAsync({ id: projectId, data: { board_stage: stage } });
    const handleDragStart = (event, project) => {
        setDraggingProjectId(project.id);
        event.dataTransfer.setData('projectId', String(project.id));
        event.dataTransfer.effectAllowed = 'move';
        const preview = makeDragPreview(project);
        event.dataTransfer.setDragImage(preview, 28, 22);
        window.setTimeout(() => preview.parentNode?.removeChild(preview), 0);
    };
    const handleDragEnd = () => { setDropTarget(null); setDraggingProjectId(null); };
    const hasActiveFilters = filterManager !== 'All' || filterStage !== 'All' || filterBranch !== 'All' || filterPriority !== 'All' || searchQuery !== '';
    const clearFilters = () => {
        setSearchQuery('');
        setFilterManager('All');
        setFilterStage('All');
        setFilterBranch('All');
        setFilterPriority('All');
    };

    const headerCenter = (
        <label className="premium-search officer-toolbar__search">
            <Search size={16} color="var(--tx3)" />
            <input type="search" placeholder="Search projects or managers" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
        </label>
    );

    const headerFilters = (
        <div className="premium-filter-group">
            <label className="premium-filter officer-toolbar__filter"><Users size={14} color="var(--tx3)" /><select value={filterManager} onChange={(event) => setFilterManager(event.target.value)}>{uniqueManagers.map((manager) => <option key={manager} value={manager}>{manager === 'All' ? 'All managers' : manager}</option>)}</select></label>
            <label className="premium-filter officer-toolbar__filter"><Layout size={14} color="var(--tx3)" /><select value={filterStage} onChange={(event) => setFilterStage(event.target.value)}><option value="All">All stages</option>{EXECUTION_BOARD_STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}</select></label>
            <label className="premium-filter officer-toolbar__filter"><MapPin size={14} color="var(--tx3)" /><select value={filterBranch} onChange={(event) => setFilterBranch(event.target.value)}>{uniqueBranches.map((branch) => <option key={branch} value={branch}>{branch === 'All' ? 'All branches' : branch}</option>)}</select></label>
            <label className="premium-filter officer-toolbar__filter"><AlertTriangle size={14} color="var(--tx3)" /><select value={filterPriority} onChange={(event) => setFilterPriority(event.target.value)}><option value="All">All priorities</option><option value="high">High priority</option><option value="medium">Medium priority</option><option value="low">Low priority</option></select></label>
        </div>
    );

    const actions = (
        <>
            <div className="officer-view-toggle">{VIEW_MODES.map((mode) => <button key={mode} type="button" className={`premium-action-button${viewMode === mode ? ' premium-action-button--primary' : ''}`} onClick={() => setViewMode(mode)}>{mode}</button>)}</div>
            {hasActiveFilters ? <button type="button" className="premium-action-button" onClick={clearFilters}><X size={14} />Clear</button> : null}
            <button type="button" className="premium-action-button premium-action-button--primary" onClick={refreshBoard}><RefreshCw size={14} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} />Refresh</button>
        </>
    );

    return (
        <>
            <Suspense fallback={null}>{modalProject ? <ProjectBoardModal project={modalProject} onClose={() => setSelectedProject(null)} updateProjectFull={async (id, data) => { await projectsService.updateProject(id, data); await refreshBoard(); }} /> : null}</Suspense>
            <AppShell activeNav="projectOfficer" title="Project Officer" subtitle={managerColumns.length ? 'Cleaner manager columns, smoother drag-and-drop, and clearer assignment load.' : 'A clean assignment board ready for your first manager column.'} headerCenter={headerCenter} headerFilters={headerFilters} actions={actions}>
                <div className="saas-stat-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                    <KpiCard label="Managers" value={summary.managers} />
                    <KpiCard label="Assigned" value={summary.assigned} tone="green" />
                    <KpiCard label="Urgent" value={summary.urgent} tone="red" className="saas-kpi--alert" />
                    <KpiCard label="Booked" value={summary.full} tone="orange" />
                </div>

                <AlertBanner message={timelineError?.message} />

                {showAddManager ? (
                    <div className="premium-panel" style={{ padding: '18px 20px' }}>
                        <div className="officer-add-manager">
                            <div className="officer-add-manager__copy"><div className="officer-column__label">Add Manager</div><div className="officer-column__name">Create a new manager column instantly</div></div>
                            <label className="premium-search officer-add-manager__input"><UserPlus size={16} color="var(--tx3)" /><input autoFocus type="text" placeholder="Enter manager name" value={newManagerName} onChange={(event) => setNewManagerName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') createManagerMutation.mutate({ name: newManagerName }); }} /></label>
                            <div className="officer-add-manager__actions"><button type="button" className="premium-action-button premium-action-button--primary" disabled={createManagerMutation.isPending} onClick={() => createManagerMutation.mutate({ name: newManagerName })}>{createManagerMutation.isPending ? 'Saving' : 'Save manager'}</button><button type="button" className="premium-action-button" onClick={() => setShowAddManager(false)}>Cancel</button></div>
                        </div>
                    </div>
                ) : <div className="officer-utility-row"><button type="button" className="premium-action-button" onClick={() => setShowAddManager(true)}><UserPlus size={14} />Add manager</button></div>}

                <div className="premium-panel" style={{ padding: '20px' }}>
                    {isLoading ? (
                        <div className="officer-loading-shell">
                            {[1, 2, 3].map((column) => (
                                <div key={column} className="officer-loading-column">
                                    <div className="officer-skeleton officer-skeleton--header" />
                                    <div className="officer-skeleton officer-skeleton--bar" />
                                    {[1, 2, 3].map((card) => (
                                        <div key={card} className="officer-card officer-card--loading">
                                            <div className="officer-skeleton officer-skeleton--eyebrow" />
                                            <div className="officer-skeleton officer-skeleton--title" />
                                            <div className="officer-skeleton officer-skeleton--line" />
                                            <div className="officer-skeleton officer-skeleton--line short" />
                                        </div>
                                    ))}
                                </div>
                            ))}
                            <div className={`officer-sidepanel officer-sidepanel--loading${collapsedPanel ? ' is-collapsed' : ''}`}>
                                {!collapsedPanel ? (
                                    <>
                                        <div className="officer-skeleton officer-skeleton--header" />
                                        <div className="officer-card officer-card--loading">
                                            <div className="officer-skeleton officer-skeleton--eyebrow" />
                                            <div className="officer-skeleton officer-skeleton--title" />
                                            <div className="officer-skeleton officer-skeleton--line" />
                                        </div>
                                        <div className="officer-card officer-card--loading">
                                            <div className="officer-skeleton officer-skeleton--eyebrow" />
                                            <div className="officer-skeleton officer-skeleton--title" />
                                            <div className="officer-skeleton officer-skeleton--line short" />
                                        </div>
                                    </>
                                ) : null}
                            </div>
                        </div>
                    ) : (
                        <div className="officer-layout">
                            <div className="officer-board">
                                {managerColumns.length === 0 ? (
                                    <EmptyState title="No managers added" description="Create the first manager to start mapping projects across the board." action={<button type="button" className="premium-action-button premium-action-button--primary" onClick={() => setShowAddManager(true)}><UserPlus size={14} />Add first manager</button>} />
                                ) : managerColumns.map((column) => (
                                    <ManagerColumn key={column.key} column={column} viewMode={viewMode} dropTarget={dropTarget} setDropTarget={setDropTarget} onDropProject={handleDropProject} draggingId={draggingProjectId} onOpen={setSelectedProject} onStageChange={handleStageChange} onDragStart={handleDragStart} onDragEnd={handleDragEnd} />
                                ))}
                            </div>

                            <aside
                                className={`officer-sidepanel${collapsedPanel ? ' is-collapsed' : ''}${dropTarget === 'unassigned' ? ' is-drop-target' : ''}`}
                                onDragOver={(event) => { event.preventDefault(); setDropTarget('unassigned'); }}
                                onDragLeave={() => setDropTarget((current) => current === 'unassigned' ? null : current)}
                                onDrop={(event) => {
                                    event.preventDefault();
                                    const projectId = Number(event.dataTransfer.getData('projectId'));
                                    if (projectId) handleDropProject(projectId, null);
                                }}
                            >
                                <div className="officer-sidepanel__header">
                                    <button type="button" className="premium-icon-button" onClick={() => setCollapsedPanel((value) => !value)} title={collapsedPanel ? 'Expand unassigned panel' : 'Collapse unassigned panel'}>{collapsedPanel ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}</button>
                                    {!collapsedPanel ? <><div><div className="officer-column__label">Side Panel</div><div className="officer-column__name">Unassigned Projects</div></div><div className="officer-column__count">{unassignedProjects.length}</div></> : null}
                                </div>
                                {!collapsedPanel ? (
                                    <>
                                        <div className="officer-sidepanel__hint">Drag projects from here into manager columns, or drop cards back here to unassign them.</div>
                                        <div className="officer-sidepanel__body">
                                            <AnimatePresence mode="popLayout">
                                                {unassignedProjects.length === 0 ? (
                                                    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="officer-empty-state officer-empty-state--panel">No projects available.<span>Everything visible in the current filters is already assigned.</span></motion.div>
                                                ) : unassignedProjects.map((project) => (
                                                    <ProjectCard key={project.id} project={project} compact={viewMode === 'Day'} draggingId={draggingProjectId} onOpen={setSelectedProject} onStageChange={handleStageChange} onDragStart={handleDragStart} onDragEnd={handleDragEnd} />
                                                ))}
                                            </AnimatePresence>
                                        </div>
                                    </>
                                ) : <div className="officer-sidepanel__collapsed"><span>{unassignedProjects.length}</span><small>Unassigned</small></div>}
                            </aside>
                        </div>
                    )}
                </div>
            </AppShell>
        </>
    );
}
