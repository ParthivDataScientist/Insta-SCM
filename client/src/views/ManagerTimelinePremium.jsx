import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DndContext, PointerSensor, useDraggable, useSensor, useSensors } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Check, PanelLeft, PanelRightClose, PanelRightOpen, Plus, Search, UserSquare2, X } from 'lucide-react';
import AppShell from '../components/app/AppShell';
import AlertBanner from '../components/AlertBanner';
import TimelineHeader from '../components/GanttTimeline/TimelineHeader';
import ManagerRow from '../components/GanttTimeline/ManagerRow';
import GlobalDateRangePicker from '../components/GlobalDateRangePicker';
import projectsService from '../api/projects';
import { useGlobalDateRange } from '../contexts/GlobalDateRangeContext';
import {
    addDaysUTC,
    dateToTimelinePx,
    diffDaysUTC,
    formatUTCDate,
    getBarLayout,
    parseUTCDate,
    pxToTimelineDate,
} from '../components/GanttTimeline/timelineMath';

const ProjectBoardModal = lazy(() => import('../components/ProjectBoardModal'));
const VIEW_MODES = ['Day', 'Week', 'Month'];

const getManagerName = (row) => (typeof row.manager === 'string' ? row.manager : row.manager?.full_name || 'Unknown');
const getManagerId = (row) => (typeof row.manager === 'string' ? null : row.manager?.id ?? null);
const getStart = (item) => item.allocation_start_date || item.dispatch_date || item.event_start_date;
const getEnd = (item) => item.allocation_end_date || item.dismantling_date || item.event_end_date || getStart(item);
const getTodayDateOnly = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

function getNowOffsetPx(nowDate, timelineStart, cellWidth, viewMode) {
    const now = new Date(nowDate);
    const start = new Date(timelineStart);
    const msDiff = now.getTime() - start.getTime();
    if (msDiff <= 0) return 0;
    if (viewMode === 'Day') return (msDiff / (24 * 60 * 60 * 1000)) * cellWidth;
    if (viewMode === 'Week') return (msDiff / (24 * 60 * 60 * 1000)) * (cellWidth / 7);

    let px = 0;
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const targetMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    while (cursor < targetMonth) {
        px += cellWidth;
        cursor.setMonth(cursor.getMonth() + 1);
    }
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayWithFraction = now.getDate() - 1 + (now.getHours() * 60 + now.getMinutes()) / 1440;
    return px + (dayWithFraction / Math.max(1, daysInMonth)) * cellWidth;
}

function overlaps(left, right) {
    const leftStart = parseUTCDate(getStart(left)).getTime();
    const leftEnd = parseUTCDate(getEnd(left)).getTime();
    const rightStart = parseUTCDate(getStart(right)).getTime();
    const rightEnd = parseUTCDate(getEnd(right)).getTime();
    return leftStart <= rightEnd && rightStart <= leftEnd;
}

function applyCommit(rows, projectId, payload) {
    const next = rows.map((row) => ({ ...row, allocations: [...(row.allocations || row.projects || [])] }));
    let moving = null;
    let fromIndex = -1;

    next.forEach((row, rowIndex) => {
        const idx = row.allocations.findIndex((alloc) => (alloc.project?.id || alloc.id) === projectId);
        if (idx >= 0) {
            moving = { ...row.allocations[idx], project: { ...(row.allocations[idx].project || row.allocations[idx]) } };
            row.allocations.splice(idx, 1);
            fromIndex = rowIndex;
        }
    });

    if (!moving) return rows;

    if (payload.allocation_start_date) {
        moving.allocation_start_date = payload.allocation_start_date;
        moving.project.dispatch_date = payload.allocation_start_date;
        moving.project.allocation_start_date = payload.allocation_start_date;
    }
    if (payload.allocation_end_date) {
        moving.allocation_end_date = payload.allocation_end_date;
        moving.project.dismantling_date = payload.allocation_end_date;
        moving.project.allocation_end_date = payload.allocation_end_date;
    }

    const targetManager = Object.prototype.hasOwnProperty.call(payload, 'manager_id')
        ? payload.manager_id
        : getManagerId(next[fromIndex]);
    const targetRow = next.find((row) => getManagerId(row) === targetManager) || next[fromIndex];
    targetRow.allocations.push(moving);
    return next;
}

function UnassignedProjectCard({ project }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `unassigned-${project.id}`,
        data: { project },
    });
    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
    };
    return (
        <button type="button" ref={setNodeRef} {...listeners} {...attributes} className="project-officer__unassigned-card" style={style}>
            <strong>{project.project_name || `Project ${project.id}`}</strong>
            <span>{project.crm_project_id || `ID-${project.id}`}</span>
        </button>
    );
}

export default function ManagerTimelinePremium() {
    const queryClient = useQueryClient();
    const { dateRange } = useGlobalDateRange();
    const [viewMode, setViewMode] = useState('Week');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProject, setSelectedProject] = useState(null);
    const [localTimeline, setLocalTimeline] = useState([]);
    const [dependencyWarning, setDependencyWarning] = useState('');
    const [drawerOpen, setDrawerOpen] = useState(true);
    const [now, setNow] = useState(() => new Date());
    const [inlineManagerName, setInlineManagerName] = useState('');
    const [isInlineManagerOpen, setIsInlineManagerOpen] = useState(false);
    const [visibleMonthLabel, setVisibleMonthLabel] = useState('');
    const scrollRef = useRef(null);
    const prependShiftPxRef = useRef(0);
    const hasAutoCenteredRef = useRef(false);
    const sensors = useSensors(useSensor(PointerSensor));

    const [timeWindow, setTimeWindow] = useState(() => {
        const current = new Date();
        return {
            start: new Date(current.getFullYear(), current.getMonth() - 3, 1),
            end: new Date(current.getFullYear(), current.getMonth() + 6, 0),
        };
    });

    const { data: timelineData = [], error } = useQuery({
        queryKey: ['manager_timeline'],
        queryFn: projectsService.fetchTimeline,
        staleTime: 10000,
    });

    useEffect(() => {
        setLocalTimeline(timelineData);
    }, [timelineData]);

    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 30000);
        return () => window.clearInterval(timer);
    }, []);

    const allProjects = useMemo(
        () => localTimeline.flatMap((row) => (row.allocations || row.projects || []).map((alloc) => alloc.project || alloc)),
        [localTimeline],
    );

    const dependencyQuery = useQuery({
        queryKey: ['project-dependencies', allProjects.map((project) => project.id).join(',')],
        enabled: allProjects.length > 0,
        queryFn: async () => {
            const linksByProject = await Promise.all(
                allProjects.map(async (project) => ({ projectId: project.id, links: await projectsService.fetchProjectLinks(project.id) })),
            );
            const graph = {};
            linksByProject.forEach(({ projectId, links }) => {
                const parents = links
                    .filter((link) => link.link_type === 'other')
                    .map((link) => {
                        const labelMatch = /depends[_\s-]*on[:#\s-]*(\d+)/i.exec(link.label || '');
                        const urlMatch = /projects\/(\d+)/i.exec(link.url || '');
                        return Number(labelMatch?.[1] || urlMatch?.[1] || 0);
                    })
                    .filter((id) => Number.isFinite(id) && id > 0);
                if (parents.length) graph[projectId] = parents;
            });
            return graph;
        },
        staleTime: 30000,
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => projectsService.updateProjectPatch(id, data),
        onSettled: async () => {
            await queryClient.invalidateQueries({ queryKey: ['manager_timeline'] });
            await queryClient.invalidateQueries({ queryKey: ['projects'] });
        },
    });

    const createManagerMutation = useMutation({
        mutationFn: (payload) => projectsService.createManager(payload),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['manager_timeline'] });
        },
    });

    const filteredRows = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return localTimeline
            .map((row) => {
                const managerName = getManagerName(row);
                const allocations = (row.allocations || row.projects || []).filter((alloc) => {
                    const project = alloc.project || alloc;
                    const anchor = getStart(project);
                    if (dateRange.start && anchor && parseUTCDate(anchor) < parseUTCDate(dateRange.start)) return false;
                    if (dateRange.end && anchor && parseUTCDate(anchor) > parseUTCDate(dateRange.end)) return false;
                    if (!query) return true;
                    return [managerName, project.project_name, project.crm_project_id, project.branch]
                        .filter(Boolean)
                        .some((value) => value.toLowerCase().includes(query));
                });
                if (!allocations.length && query) return null;
                return { ...row, allocations };
            })
            .filter(Boolean);
    }, [localTimeline, searchQuery, dateRange.end, dateRange.start]);

    const managerRows = useMemo(() => filteredRows.filter((row) => getManagerName(row) !== 'Unassigned'), [filteredRows]);
    const unassignedProjects = useMemo(() => {
        const row = filteredRows.find((entry) => getManagerName(entry) === 'Unassigned');
        return (row?.allocations || []).map((alloc) => alloc.project || alloc);
    }, [filteredRows]);

    const managerConflicts = useMemo(() => {
        const conflictMap = {};
        managerRows.forEach((row) => {
            const managerId = getManagerId(row);
            if (managerId === null) return;
            const allocations = row.allocations || [];
            const conflictIds = new Set();
            allocations.forEach((left, index) => {
                allocations.slice(index + 1).forEach((right) => {
                    if (overlaps(left, right)) {
                        conflictIds.add(left.project?.id || left.id);
                        conflictIds.add(right.project?.id || right.id);
                    }
                });
            });
            conflictMap[managerId] = conflictIds;
        });
        return conflictMap;
    }, [managerRows]);

    const timelineUnits = useMemo(() => {
        const units = [];
        const cursor = new Date(timeWindow.start);
        if (viewMode === 'Day') {
            while (cursor <= timeWindow.end) {
                units.push(new Date(cursor));
                cursor.setDate(cursor.getDate() + 1);
            }
            return units;
        }
        if (viewMode === 'Week') {
            while (cursor <= timeWindow.end) {
                units.push(new Date(cursor));
                cursor.setDate(cursor.getDate() + 7);
            }
            return units;
        }
        while (cursor <= timeWindow.end) {
            units.push(new Date(cursor));
            cursor.setMonth(cursor.getMonth() + 1);
        }
        return units;
    }, [timeWindow.end, timeWindow.start, viewMode]);

    const cellWidth = viewMode === 'Day' ? 44 : viewMode === 'Week' ? 176 : 520;
    const todayLineLeft = 260 + getNowOffsetPx(now, timeWindow.start, cellWidth, viewMode);

    useEffect(() => {
        const node = scrollRef.current;
        if (!node) return;
        if (prependShiftPxRef.current > 0) {
            node.scrollLeft += prependShiftPxRef.current;
            prependShiftPxRef.current = 0;
            return;
        }
        if (!hasAutoCenteredRef.current) {
            const targetLeft = Math.max(0, todayLineLeft - node.clientWidth * 0.45);
            node.scrollLeft = targetLeft;
            hasAutoCenteredRef.current = true;
        }
    }, [todayLineLeft]);

    useEffect(() => {
        hasAutoCenteredRef.current = false;
    }, [viewMode]);

    useEffect(() => {
        const node = scrollRef.current;
        if (!node) return;
        const px = Math.max(0, node.scrollLeft);
        const index = Math.min(
            Math.max(0, Math.floor(px / Math.max(1, cellWidth))),
            Math.max(0, timelineUnits.length - 1),
        );
        const date = timelineUnits[index] || new Date();
        setVisibleMonthLabel(
            date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        );
    }, [cellWidth, timelineUnits, viewMode]);

    const stats = useMemo(() => {
        const total = allProjects.length;
        const overdue = allProjects.filter((project) => parseUTCDate(getEnd(project)) < parseUTCDate(now)).length;
        const managerCount = managerRows.filter((row) => getManagerId(row) !== null).length || 1;
        const assigned = managerRows.reduce((sum, row) => sum + (row.allocations?.length || 0), 0);
        const load = Math.min(100, Math.round((assigned / (managerCount * 4)) * 100));
        return { total, overdue, load };
    }, [allProjects, managerRows, now]);

    const projectIndex = useMemo(() => {
        const map = {};
        allProjects.forEach((project) => {
            map[project.id] = project;
        });
        return map;
    }, [allProjects]);

    const handleAllocationCommit = async (projectId, payload) => {
        setDependencyWarning('');
        const current = projectIndex[projectId];
        const todayDate = getTodayDateOnly();
        const currentStart = parseUTCDate(current?.dispatch_date || current?.allocation_start_date || todayDate);
        const currentEnd = parseUTCDate(current?.dismantling_date || current?.allocation_end_date || currentStart);
        const currentDurationDays = Math.max(0, diffDaysUTC(currentStart, currentEnd));
        const rawNextStart = payload.allocation_start_date || current?.dispatch_date || current?.allocation_start_date;
        const parsedNextStart = rawNextStart ? parseUTCDate(rawNextStart) : todayDate;
        const boundedStart = parsedNextStart < todayDate ? todayDate : parsedNextStart;
        const nextStart = formatUTCDate(boundedStart);
        const nextEnd = payload.allocation_end_date
            ? formatUTCDate(parseUTCDate(payload.allocation_end_date) < boundedStart ? addDaysUTC(boundedStart, currentDurationDays) : parseUTCDate(payload.allocation_end_date))
            : formatUTCDate(addDaysUTC(boundedStart, currentDurationDays));
        const normalizedPayload = {
            ...payload,
            allocation_start_date: nextStart,
            allocation_end_date: nextEnd,
        };
        const deps = dependencyQuery.data?.[projectId] || [];
        const violatingParent = deps.find((parentId) => {
            const parent = projectIndex[parentId];
            if (!parent || !nextStart) return false;
            return parseUTCDate(nextStart) < parseUTCDate(getEnd(parent));
        });
        if (violatingParent) {
            setDependencyWarning(`Dependency blocked: project ${projectId} cannot start before project ${violatingParent} ends.`);
            return;
        }

        const snapshot = localTimeline;
        setLocalTimeline((rows) => applyCommit(rows, Number(projectId), normalizedPayload));
        try {
            const updatePayload = {};
            if (Object.prototype.hasOwnProperty.call(normalizedPayload, 'manager_id')) {
                updatePayload.manager_id = normalizedPayload.manager_id ?? null;
            }
            if (normalizedPayload.allocation_start_date) {
                updatePayload.dispatch_date = normalizedPayload.allocation_start_date;
                updatePayload.allocation_start_date = normalizedPayload.allocation_start_date;
            }
            if (normalizedPayload.allocation_end_date) {
                updatePayload.dismantling_date = normalizedPayload.allocation_end_date;
                updatePayload.allocation_end_date = normalizedPayload.allocation_end_date;
            }
            await updateMutation.mutateAsync({ id: projectId, data: updatePayload });
        } catch (commitError) {
            setLocalTimeline(snapshot);
            window.alert(commitError.response?.data?.detail || commitError.message || 'Failed to save schedule change');
        }
    };

    const dependencyLines = useMemo(() => {
        const graph = dependencyQuery.data || {};
        const positions = {};
        let rowOffset = 64;
        managerRows.forEach((row) => {
            const allocations = [...(row.allocations || [])].sort(
                (left, right) => parseUTCDate(getStart(left)).getTime() - parseUTCDate(getStart(right)).getTime(),
            );
            const levels = [];
            const stacked = allocations.map((alloc) => {
                const start = parseUTCDate(getStart(alloc));
                const end = parseUTCDate(getEnd(alloc));
                let levelIndex = 0;
                while (true) {
                    if (!levels[levelIndex] || start > levels[levelIndex]) {
                        levels[levelIndex] = end;
                        return { ...alloc, levelIndex };
                    }
                    levelIndex += 1;
                }
            });
            const rowHeight = Math.max(48, Math.max(...stacked.map((alloc) => alloc.levelIndex + 1), 1) * 36 + 12);
            stacked.forEach((alloc) => {
                const layout = getBarLayout(getStart(alloc), getEnd(alloc), timeWindow.start, cellWidth, viewMode);
                const id = alloc.project?.id || alloc.id;
                const centerY = rowOffset + 8 + alloc.levelIndex * 40 + 16;
                positions[id] = { startX: 260 + layout.left, endX: 260 + layout.left + layout.width, y: centerY };
            });
            rowOffset += rowHeight;
        });

        return Object.entries(graph).flatMap(([childId, parentIds]) =>
            parentIds
                .map((parentId) => {
                    const from = positions[parentId];
                    const to = positions[childId];
                    if (!from || !to) return null;
                    const midX = from.endX + 24;
                    return { key: `${parentId}-${childId}`, d: `M${from.endX},${from.y} L${midX},${from.y} L${midX},${to.y} L${to.startX},${to.y}` };
                })
                .filter(Boolean),
        );
    }, [cellWidth, dependencyQuery.data, managerRows, timeWindow.start, viewMode]);

    const handleDnDEnd = async (event) => {
        const overId = event?.over?.id;
        const project = event?.active?.data?.current?.project;
        if (!overId || !project || !String(overId).startsWith('manager-row-')) return;
        const managerIdRaw = String(overId).replace('manager-row-', '');
        const managerId = Number(managerIdRaw);
        if (!Number.isFinite(managerId)) return;
        const clientX = event.activatorEvent?.clientX ?? 0;
        const scroller = scrollRef.current;
        if (!scroller) return;
        const rect = scroller.getBoundingClientRect();
        const rawPx = Math.max(0, scroller.scrollLeft + clientX - rect.left - 260);
        const nextStart = pxToTimelineDate(rawPx, timeWindow.start, cellWidth, viewMode);
        const durationDays = Math.max(0, diffDaysUTC(getStart(project), getEnd(project)));
        const nextEnd = addDaysUTC(nextStart, durationDays);
        await handleAllocationCommit(project.id, {
            manager_id: managerId,
            allocation_start_date: formatUTCDate(nextStart),
            allocation_end_date: formatUTCDate(nextEnd),
        });
    };

    const handleTimelineWheel = (event) => {
        const node = scrollRef.current;
        if (!node) return;
        const canScrollX = node.scrollWidth > node.clientWidth + 1;
        if (!canScrollX) return;
        const horizontalIntent = event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);
        if (!horizontalIntent) return;
        event.preventDefault();
        node.scrollLeft += event.deltaX !== 0 ? event.deltaX : event.deltaY;
    };

    const handleTimelineScroll = () => {
        const node = scrollRef.current;
        if (!node || timelineUnits.length === 0) return;
        const px = Math.max(0, node.scrollLeft);
        const index = Math.min(
            Math.max(0, Math.floor(px / Math.max(1, cellWidth))),
            Math.max(0, timelineUnits.length - 1),
        );
        const date = timelineUnits[index] || new Date();
        setVisibleMonthLabel(
            date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        );

        const nearLeft = node.scrollLeft < 120;
        const nearRight = node.scrollLeft + node.clientWidth > node.scrollWidth - 120;
        if (nearLeft) {
            const previousStart = new Date(timeWindow.start);
            const nextStart = new Date(previousStart.getFullYear(), previousStart.getMonth() - 3, 1);
            const addedPx = dateToTimelinePx(previousStart, nextStart, cellWidth, viewMode);
            prependShiftPxRef.current = Math.max(0, addedPx);
            setTimeWindow((prev) => ({
                start: nextStart,
                end: prev.end,
            }));
            return;
        }
        if (nearRight) {
            setTimeWindow((prev) => ({
                start: prev.start,
                end: new Date(prev.end.getFullYear(), prev.end.getMonth() + 3, 0),
            }));
        }
    };

    const handleAddManager = () => {
        setIsInlineManagerOpen(true);
        setInlineManagerName('');
    };

    const handleRemoveManager = async (managerId) => {
        if (!Number.isFinite(Number(managerId))) return;
        await projectsService.deleteManager(Number(managerId));
        await queryClient.invalidateQueries({ queryKey: ['manager_timeline'] });
    };

    const commitInlineManager = async () => {
        const name = inlineManagerName.trim();
        if (!name || createManagerMutation.isPending) return;
        await createManagerMutation.mutateAsync({ name });
        setInlineManagerName('');
        setIsInlineManagerOpen(false);
    };

    const header = ({ toggleSidebar, sidebarOpen, sidebarOverlay }) => (
        <header className="design-dashboard__header project-officer__header">
            <div className="project-officer__header-row">
                <div className="project-officer__header-left">
                    {sidebarOverlay ? (
                        <button
                            type="button"
                            className="project-officer__sidebar-toggle"
                            onClick={toggleSidebar}
                            title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
                        >
                            <PanelLeft size={16} />
                        </button>
                    ) : null}
                    <div className="project-officer__title-chip">
                        <UserSquare2 size={15} />
                        <span>Project Officer</span>
                    </div>
                    <label className="design-dashboard__search project-officer__search">
                        <Search size={16} />
                        <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search project, manager" />
                    </label>
                </div>
                <div className="project-officer__header-right">
                    <GlobalDateRangePicker compact label={false} className="design-dashboard__date-range project-officer__date-range" />
                    <div className="design-dashboard__header-actions">
                        {VIEW_MODES.map((mode) => (
                            <button
                                key={mode}
                                type="button"
                                className={`design-dashboard__action-button ${viewMode === mode ? 'design-dashboard__action-button--primary' : ''}`}
                                onClick={() => setViewMode(mode)}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>
                    <button type="button" className="design-dashboard__action-button" onClick={handleAddManager}>
                        <Plus size={14} /> Add Manager
                    </button>
                </div>
            </div>
            {/* legacy row removed; keep compact one-line header */}
            <div style={{ display: 'none' }}>
                {sidebarOverlay ? (
                    <button
                        type="button"
                        className="project-officer__sidebar-toggle"
                        onClick={toggleSidebar}
                        title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
                    >
                        <PanelLeft size={16} />
                    </button>
                ) : null}
                <button
                    type="button"
                    className="design-dashboard__action-button"
                    onClick={handleAddManager}
                >
                    <Plus size={14} /> Add Manager
                </button>
            </div>
        </header>
    );

    return (
        <>
            <Suspense fallback={null}>
                {selectedProject ? (
                    <ProjectBoardModal
                        project={selectedProject}
                        onClose={() => setSelectedProject(null)}
                        updateProjectFull={async (id, data) => projectsService.updateProjectPatch(id, data)}
                    />
                ) : null}
            </Suspense>
            <AppShell
                activeNav="projectOfficer"
                title="Project Officer"
                subtitle={`Total Tasks: ${stats.total} | Overdue: ${stats.overdue} | Resource Load: ${stats.load}%`}
                header={header}
                showGlobalDate={false}
                mainClassName="premium-main--design project-officer-main"
                pageClassName="design-dashboard-page project-officer-page"
                sidebarOverlay
            >
                <AlertBanner message={error?.message || dependencyWarning} />
                <DndContext sensors={sensors} onDragEnd={handleDnDEnd}>
                    <div className="project-officer__layout">
                        <div className="design-dashboard__table-shell project-officer__timeline-shell">
                            <div className="project-officer__month-pill">{visibleMonthLabel}</div>
                            <div
                                ref={scrollRef}
                                data-gantt-scroll-container="true"
                                className="project-officer__scroller"
                                onWheel={handleTimelineWheel}
                                onScroll={handleTimelineScroll}
                                style={{ position: 'relative' }}
                            >
                                <div
                                    className="project-officer__canvas"
                                    style={{ width: `${timelineUnits.length * cellWidth + 260}px`, minWidth: `${timelineUnits.length * cellWidth + 260}px` }}
                                >
                                    <TimelineHeader units={timelineUnits} cellWidth={cellWidth} viewMode={viewMode} />
                                    <svg className="project-officer__dependency-layer" width={timelineUnits.length * cellWidth + 260} height={Math.max(420, managerRows.length * 70 + 90)}>
                                        {dependencyLines.map((line) => (
                                            <path key={line.key} d={line.d} fill="none" stroke="var(--gantt-dependency-line)" strokeWidth="1.5" markerEnd="url(#dependencyArrow)" />
                                        ))}
                                        <defs>
                                            <marker id="dependencyArrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                                                <path d="M0,0 L6,3 L0,6 Z" fill="var(--gantt-dependency-line)" />
                                            </marker>
                                        </defs>
                                    </svg>
                                <div className="project-officer__today-line" style={{ left: `${todayLineLeft}px` }}>
                                    <span className="project-officer__today-tag">NOW</span>
                                </div>
                                    {managerRows.map((row) => {
                                        const managerId = getManagerId(row);
                                        const conflictIds = managerConflicts[managerId] || new Set();
                                        return (
                                            <ManagerRow
                                                key={getManagerName(row)}
                                                managerData={{
                                                    ...row,
                                                    allocations: (row.allocations || []).map((alloc) => {
                                                        const projectId = alloc.project?.id || alloc.id;
                                                        return { ...alloc, hasConflict: conflictIds.has(projectId) };
                                                    }),
                                                }}
                                                timelineStart={timeWindow.start}
                                                units={timelineUnits}
                                                cellWidth={cellWidth}
                                                viewMode={viewMode}
                                                onProjectClick={setSelectedProject}
                                                onAllocationCommit={handleAllocationCommit}
                                                onRemoveManager={handleRemoveManager}
                                                hasConflict={conflictIds.size > 0}
                                            nowDate={now}
                                            />
                                        );
                                    })}
                                    {isInlineManagerOpen ? (
                                        <div className="gantt-row project-officer__inline-row">
                                            <div className="project-officer__inline-input-cell">
                                                <input
                                                    autoFocus
                                                    value={inlineManagerName}
                                                    onChange={(event) => setInlineManagerName(event.target.value)}
                                                    placeholder="Enter manager name"
                                                    onKeyDown={(event) => {
                                                        if (event.key === 'Enter') commitInlineManager();
                                                        if (event.key === 'Escape') {
                                                            setIsInlineManagerOpen(false);
                                                            setInlineManagerName('');
                                                        }
                                                    }}
                                                />
                                                <button type="button" onClick={commitInlineManager} disabled={!inlineManagerName.trim()}>
                                                    <Check size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsInlineManagerOpen(false);
                                                        setInlineManagerName('');
                                                    }}
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                            <div className="project-officer__inline-track" />
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                        <aside className={`project-officer__drawer ${drawerOpen ? 'is-open' : ''}`}>
                            <button type="button" className="project-officer__drawer-toggle" onClick={() => setDrawerOpen((value) => !value)}>
                                {drawerOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
                            </button>
                            {drawerOpen ? (
                                <>
                                    <h3>Unassigned Projects ({unassignedProjects.length})</h3>
                                    <div className="project-officer__drawer-list">
                                        {unassignedProjects.map((project) => (
                                            <UnassignedProjectCard key={project.id} project={project} />
                                        ))}
                                    </div>
                                </>
                            ) : null}
                        </aside>
                    </div>
                </DndContext>
            </AppShell>
        </>
    );
}
