import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    AlertTriangle,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Clock3,
    Layout,
    MapPin,
    Plus,
    RefreshCw,
    Search,
    Users,
} from 'lucide-react';
import { useGlobalDateRange } from '../contexts/GlobalDateRangeContext';
import projectsService from '../api/projects';
import AppShell from '../components/app/AppShell';
import KpiCard from '../components/app/KpiCard';
import TimelineHeader from '../components/GanttTimeline/TimelineHeader';
import ManagerRow from '../components/GanttTimeline/ManagerRow';
import UnassignedTray from '../components/GanttTimeline/UnassignedTray';
import { BoardSkeleton } from '../components/SkeletonLoader';
import { buildConflictWarningMessage, resolveProjectSchedule } from '../utils/managerScheduling';
import { formatDateRangeDisplay } from '../utils/dateUtils';
import { EXECUTION_BOARD_STAGES, normalizeBoardStage } from '../utils/projectStatus';

const ProjectBoardModal = lazy(() => import('../components/ProjectBoardModal'));
const VIEW_MODES = ['Day', 'Week', 'Month'];

const startOfWeek = (date) => {
    const value = new Date(date);
    const day = value.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    value.setDate(value.getDate() + diff);
    value.setHours(0, 0, 0, 0);
    return value;
};

const endOfWeek = (date) => {
    const value = startOfWeek(date);
    value.setDate(value.getDate() + 6);
    value.setHours(23, 59, 59, 999);
    return value;
};

const buildTimeWindow = (anchorDate, viewMode) => {
    const anchor = new Date(anchorDate);

    if (viewMode === 'Day') {
        return {
            start: new Date(anchor.getFullYear(), anchor.getMonth(), 1),
            end: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0),
        };
    }

    if (viewMode === 'Week') {
        const start = startOfWeek(anchor);
        start.setDate(start.getDate() - 28);
        const end = endOfWeek(anchor);
        end.setDate(end.getDate() + 56);
        return { start, end };
    }

    return {
        start: new Date(anchor.getFullYear(), anchor.getMonth() - 4, 1),
        end: new Date(anchor.getFullYear(), anchor.getMonth() + 7, 0),
    };
};

const getManagerName = (managerData) =>
    typeof managerData.manager === 'string'
        ? managerData.manager
        : (managerData.manager?.full_name || managerData.manager?.name || 'Unknown');

const getManagerAllocations = (managerData) => managerData.allocations || managerData.projects || [];

const getProjectFromAllocation = (allocation) => allocation.project || allocation;

const rangeLabel = (windowStart, windowEnd) => formatDateRangeDisplay(windowStart, windowEnd);

export default function ManagerTimelinePremium() {
    const queryClient = useQueryClient();
    const { dateRange } = useGlobalDateRange();
    const [viewMode, setViewMode] = useState('Week');
    const [anchorDate, setAnchorDate] = useState(() => new Date());
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStage, setFilterStage] = useState('All');
    const [filterBranch, setFilterBranch] = useState('All');
    const [filterManager, setFilterManager] = useState('All');
    const [selectedProject, setSelectedProject] = useState(null);
    const [showAddManager, setShowAddManager] = useState(false);
    const [newManagerName, setNewManagerName] = useState('');

    const timeWindow = useMemo(() => buildTimeWindow(anchorDate, viewMode), [anchorDate, viewMode]);
    const parentRef = useRef(null);

    const timeUnits = useMemo(() => {
        const units = [];
        const current = new Date(timeWindow.start);

        if (viewMode === 'Day') {
            while (current <= timeWindow.end) {
                units.push(new Date(current));
                current.setDate(current.getDate() + 1);
            }
        } else if (viewMode === 'Week') {
            while (current <= timeWindow.end) {
                units.push(new Date(current));
                current.setDate(current.getDate() + 7);
            }
        } else {
            while (current <= timeWindow.end) {
                units.push(new Date(current));
                current.setMonth(current.getMonth() + 1);
            }
        }

        return units;
    }, [timeWindow, viewMode]);

    const cellWidth = useMemo(() => {
        if (viewMode === 'Day') return 48;
        if (viewMode === 'Week') return 156;
        return 240;
    }, [viewMode]);

    const projectInDateRange = (project) => {
        if (!dateRange.start && !dateRange.end) return true;

        const value = project?.event_start_date || project?.dispatch_date || project?.allocation_start_date;
        if (!value) return false;

        const projectDate = new Date(value);
        if (dateRange.start && projectDate < new Date(dateRange.start)) return false;
        if (dateRange.end && projectDate > new Date(dateRange.end)) return false;
        return true;
    };

    const { data: timelineData = [], isLoading, isFetching, refetch } = useQuery({
        queryKey: ['manager_timeline'],
        queryFn: projectsService.fetchTimeline,
        staleTime: 10000,
    });

    const { data: projectsData = [] } = useQuery({
        queryKey: ['projects'],
        queryFn: projectsService.fetchProjects,
        staleTime: 10000,
    });

    const { data: managersList = [] } = useQuery({
        queryKey: ['managers_list'],
        queryFn: projectsService.fetchManagers,
    });

    const refreshTimelineCaches = async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['manager_timeline'] }),
            queryClient.invalidateQueries({ queryKey: ['projects'] }),
            queryClient.invalidateQueries({ queryKey: ['projectStats'] }),
            queryClient.invalidateQueries({ queryKey: ['managerProjects'] }),
            queryClient.invalidateQueries({ queryKey: ['managers_list'] }),
        ]);
        await refetch();
    };

    const findProjectById = (projectId) => {
        const directProject = projectsData.find((project) => project.id === projectId);
        if (directProject) {
            return directProject;
        }

        for (const managerData of timelineData) {
            for (const allocation of getManagerAllocations(managerData)) {
                const project = getProjectFromAllocation(allocation);
                if (project.id === projectId) {
                    return project;
                }
            }
        }

        return null;
    };

    const handleAllocationCommit = async (id, data) => {
        const currentProject = findProjectById(id);
        const currentWindow = resolveProjectSchedule(currentProject || {});
        const payload = {};

        if (Object.prototype.hasOwnProperty.call(data, 'manager_id')) {
            payload.manager_id = data.manager_id ?? null;
        }
        if (data.allocation_start_date) {
            payload.dispatch_date = data.allocation_start_date;
            payload.allocation_start_date = data.allocation_start_date;
        }
        if (data.allocation_end_date) {
            payload.dismantling_date = data.allocation_end_date;
            payload.allocation_end_date = data.allocation_end_date;
        }

        if (Object.keys(payload).length === 0) return;

        const targetManagerId =
            Object.prototype.hasOwnProperty.call(payload, 'manager_id')
                ? payload.manager_id
                : currentProject?.manager_id ?? null;
        const targetStartDate = payload.allocation_start_date || currentWindow.start;
        const targetEndDate = payload.allocation_end_date || currentWindow.end || targetStartDate;

        if (targetManagerId && targetStartDate) {
            const availabilityResult = await projectsService.checkAvailability(
                targetStartDate,
                targetEndDate || targetStartDate,
                targetManagerId,
                id
            );
            const availability = availabilityResult[String(targetManagerId)] || availabilityResult[targetManagerId];

            if (availability && !availability.available) {
                const managerName =
                    managersList.find((manager) => manager.id === targetManagerId)?.full_name ||
                    currentProject?.project_manager ||
                    'the selected manager';
                const shouldProceed = window.confirm(
                    buildConflictWarningMessage(
                        managerName,
                        availability.conflicts,
                        targetStartDate,
                        targetEndDate
                    )
                );
                if (!shouldProceed) {
                    return;
                }
            }
        }

        await projectsService.updateProject(id, payload);
        await refreshTimelineCaches();
    };

    const { filteredData, unassignedProjects } = useMemo(() => {
        if (!timelineData.length) return { filteredData: [], unassignedProjects: [] };

        const projectMatchesFilters = (project) => {
            if (!projectInDateRange(project)) {
                return false;
            }

            if (filterStage !== 'All' && normalizeBoardStage(project.board_stage) !== filterStage) {
                return false;
            }

            if (filterBranch !== 'All') {
                const branchValue = project.branch || '';
                const venueValue = project.venue || '';
                if (branchValue !== filterBranch && !venueValue.includes(filterBranch)) {
                    return false;
                }
            }

            return true;
        };

        const unassignedRow = timelineData.find((managerData) => getManagerName(managerData) === 'Unassigned');
        const unassigned = unassignedRow
            ? (
                filterManager === 'All'
                    ? getManagerAllocations(unassignedRow).map(getProjectFromAllocation).filter(projectMatchesFilters)
                    : []
            )
            : [];

        const managers = timelineData
            .filter((managerData) => getManagerName(managerData) !== 'Unassigned')
            .map((managerData) => ({
                ...managerData,
                allocations: getManagerAllocations(managerData).filter((allocation) => projectMatchesFilters(getProjectFromAllocation(allocation))),
            }))
            .filter((managerData) => {
                const managerName = getManagerName(managerData);
                const normalizedManagerName = managerName.toLowerCase();
                const normalizedQuery = searchQuery.toLowerCase();
                const hasProjectFilters = filterStage !== 'All' || filterBranch !== 'All';
                const allocationMatch = managerData.allocations.some((allocation) => {
                    const project = getProjectFromAllocation(allocation);
                    return (
                        (project.project_name || '').toLowerCase().includes(normalizedQuery) ||
                        (project.event_name || '').toLowerCase().includes(normalizedQuery) ||
                        (project.branch || '').toLowerCase().includes(normalizedQuery)
                    );
                });
                const nameMatch = !normalizedQuery || normalizedManagerName.includes(normalizedQuery) || allocationMatch;

                if (!nameMatch) return false;
                if (filterManager !== 'All' && managerName !== filterManager) return false;
                if (!hasProjectFilters) return true;
                return managerData.allocations.length > 0 || filterManager === managerName;
            });

        return { filteredData: managers, unassignedProjects: unassigned };
    }, [filterBranch, filterManager, filterStage, searchQuery, timelineData, dateRange.start, dateRange.end]);

    const modalProject = useMemo(() => {
        if (!selectedProject) return null;

        return projectsData.find((project) => project.id === selectedProject.id) || selectedProject;
    }, [projectsData, selectedProject]);

    const uniqueBranches = useMemo(() => {
        const branches = new Set(['All']);
        timelineData.forEach((managerData) => {
            getManagerAllocations(managerData).forEach((allocation) => {
                const project = getProjectFromAllocation(allocation);
                if (project.branch) branches.add(project.branch);
            });
        });
        return Array.from(branches).sort();
    }, [timelineData]);
    const uniqueManagers = useMemo(
        () => ['All', ...new Set(timelineData
            .filter((managerData) => getManagerName(managerData) !== 'Unassigned')
            .map((managerData) => getManagerName(managerData))
            .filter(Boolean))].sort(),
        [timelineData]
    );

    const summary = useMemo(() => {
        const now = new Date();
        let conflictWarnings = 0;
        let fullyBookedManagers = 0;
        let availableNow = 0;

        filteredData.forEach((managerData) => {
            const allocations = managerData.allocations || [];
            if (allocations.length >= 4) fullyBookedManagers += 1;

            const activeNow = allocations.some((allocation) => {
                const project = getProjectFromAllocation(allocation);
                const start = new Date(project.dispatch_date || project.allocation_start_date || project.event_start_date);
                const end = new Date(project.dismantling_date || project.allocation_end_date || project.event_end_date || start);
                return now >= start && now <= end;
            });

            if (!activeNow) availableNow += 1;

            for (let index = 0; index < allocations.length; index += 1) {
                const left = getProjectFromAllocation(allocations[index]);
                const leftStart = new Date(left.dispatch_date || left.allocation_start_date || left.event_start_date);
                const leftEnd = new Date(left.dismantling_date || left.allocation_end_date || left.event_end_date || leftStart);

                const overlaps = allocations.some((otherAllocation, otherIndex) => {
                    if (index === otherIndex) return false;
                    const right = getProjectFromAllocation(otherAllocation);
                    const rightStart = new Date(right.dispatch_date || right.allocation_start_date || right.event_start_date);
                    const rightEnd = new Date(right.dismantling_date || right.allocation_end_date || right.event_end_date || rightStart);
                    return leftStart <= rightEnd && leftEnd >= rightStart;
                });

                if (overlaps) {
                    conflictWarnings += 1;
                    break;
                }
            }
        });

        return {
            totalManagers: filteredData.length,
            conflictWarnings,
            fullyBookedManagers,
            availableNow,
        };
    }, [filteredData]);

    useEffect(() => {
        if (isLoading || !parentRef.current) return;

        const now = new Date();
        const start = new Date(timeWindow.start);
        const diffDays = Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
        const pxPerDay = viewMode === 'Day' ? cellWidth : viewMode === 'Week' ? (cellWidth / 7) : (cellWidth / 30);
        const scrollLeft = Math.max(0, diffDays * pxPerDay - 320);

        window.requestAnimationFrame(() => {
            if (parentRef.current) {
                parentRef.current.scrollLeft = scrollLeft;
            }
        });
    }, [cellWidth, isLoading, timeWindow.start, viewMode]);

    const shiftTimeline = (direction) => {
        setAnchorDate((current) => {
            const next = new Date(current);
            if (viewMode === 'Day') {
                next.setDate(next.getDate() + direction * 14);
            } else if (viewMode === 'Week') {
                next.setDate(next.getDate() + direction * 28);
            } else {
                next.setMonth(next.getMonth() + direction * 3);
            }
            return next;
        });
    };

    const createManager = async () => {
        const name = newManagerName.trim();
        if (!name) return;

        try {
            await projectsService.createManager({ name });
            setNewManagerName('');
            setShowAddManager(false);
            await refreshTimelineCaches();
        } catch (error) {
            window.alert(error.response?.data?.detail || error.message || 'Failed to create manager');
        }
    };

    const headerCenter = (
        <label className="premium-search">
            <Search size={16} color="var(--tx3)" />
            <input
                type="search"
                placeholder="Search managers, projects, or events..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
            />
        </label>
    );

    const actions = (
        <>
            <button type="button" className="premium-action-button" onClick={() => setAnchorDate(new Date())}>
                Today
            </button>
            <button type="button" className="premium-action-button premium-action-button--primary" onClick={refreshTimelineCaches}>
                <RefreshCw size={14} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} />
                Refresh
            </button>
        </>
    );

    const toolbar = (
        <div className="premium-filter-group" style={{ justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                <label className="premium-inline-filter">
                    <span className="premium-inline-filter__label">Stage</span>
                    <span className="premium-filter">
                        <Layout size={14} color="var(--tx3)" />
                        <select value={filterStage} onChange={(event) => setFilterStage(event.target.value)}>
                            <option value="All">All</option>
                            {EXECUTION_BOARD_STAGES.map((stage) => (
                                <option key={stage} value={stage}>
                                    {stage}
                                </option>
                            ))}
                        </select>
                    </span>
                </label>

                <label className="premium-inline-filter">
                    <span className="premium-inline-filter__label">Branch</span>
                    <span className="premium-filter">
                        <MapPin size={14} color="var(--tx3)" />
                        <select value={filterBranch} onChange={(event) => setFilterBranch(event.target.value)}>
                            {uniqueBranches.map((branch) => (
                                <option key={branch} value={branch}>
                                    {branch === 'All' ? 'All' : branch}
                                </option>
                            ))}
                        </select>
                    </span>
                </label>

                <label className="premium-inline-filter">
                    <span className="premium-inline-filter__label">Manager</span>
                    <span className="premium-filter">
                        <Users size={14} color="var(--tx3)" />
                        <select value={filterManager} onChange={(event) => setFilterManager(event.target.value)}>
                            {uniqueManagers.map((manager) => (
                                <option key={manager} value={manager}>
                                    {manager === 'All' ? 'All' : manager}
                                </option>
                            ))}
                        </select>
                    </span>
                </label>

                <div className="premium-range-picker">
                    <button type="button" className="premium-icon-button" onClick={() => shiftTimeline(-1)}>
                        <ChevronLeft size={16} />
                    </button>
                    <span className="premium-range-picker__label">
                        {rangeLabel(timeWindow.start, timeWindow.end)}
                    </span>
                    <button type="button" className="premium-icon-button" onClick={() => shiftTimeline(1)}>
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <button type="button" className="premium-action-button" onClick={() => setShowAddManager((open) => !open)}>
                    <Plus size={14} />
                    Add Manager
                </button>

                <div className="premium-segmented">
                    {VIEW_MODES.map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            className={`premium-segmented__button${viewMode === mode ? ' is-active' : ''}`}
                            onClick={() => setViewMode(mode)}
                        >
                            {mode}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <>
            <Suspense fallback={null}>
                {modalProject ? (
                    <ProjectBoardModal
                        project={modalProject}
                        onClose={() => setSelectedProject(null)}
                        updateProjectFull={async (id, data) => {
                            if (
                                Object.prototype.hasOwnProperty.call(data, 'manager_id') ||
                                Object.prototype.hasOwnProperty.call(data, 'allocation_start_date') ||
                                Object.prototype.hasOwnProperty.call(data, 'allocation_end_date')
                            ) {
                                await handleAllocationCommit(id, data);
                                return;
                            }

                            await projectsService.updateProject(id, data);
                            await refreshTimelineCaches();
                        }}
                    />
                ) : null}
            </Suspense>

            <AppShell
                activeNav="timeline"
                title="Resource Timeline"
                subtitle="Manager allocation, workload, and schedule balancing."
                headerCenter={headerCenter}
                actions={actions}
                toolbar={toolbar}
            >
                <div className="premium-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                    <KpiCard icon={Users} label="Managers" value={summary.totalManagers} detail="Visible in current filters" tone="blue" />
                    <KpiCard icon={AlertTriangle} label="Conflicts" value={summary.conflictWarnings} detail="Scheduling overlaps to review" tone="red" />
                    <KpiCard icon={Clock3} label="Fully Booked" value={summary.fullyBookedManagers} detail="Managers with heavy allocations" tone="orange" />
                    <KpiCard icon={Calendar} label="Available Now" value={summary.availableNow} detail="Managers free in the current window" tone="green" />
                </div>

                {showAddManager ? (
                    <div className="premium-panel" style={{ padding: '16px 18px' }}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <label className="premium-search" style={{ maxWidth: '360px' }}>
                                <Plus size={16} color="var(--tx3)" />
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Enter manager name"
                                    value={newManagerName}
                                    onChange={(event) => setNewManagerName(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            createManager();
                                        }
                                    }}
                                />
                            </label>
                            <button type="button" className="premium-action-button premium-action-button--primary" onClick={createManager}>
                                Save manager
                            </button>
                            <button type="button" className="premium-action-button" onClick={() => setShowAddManager(false)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : null}

                <div className="premium-panel premium-timeline-shell">
                    <div className="premium-timeline-shell__body">
                        <div
                            ref={parentRef}
                            data-gantt-scroll-container="true"
                            className="premium-timeline-window"
                        >
                            {isLoading ? (
                                <div style={{ padding: '40px' }}>
                                    <BoardSkeleton stages={['Loading timeline']} />
                                </div>
                            ) : (
                                <div style={{ minWidth: '100%', width: (timeUnits.length * cellWidth) + 240, minHeight: '100%', position: 'relative' }}>
                                    <TimelineHeader units={timeUnits} cellWidth={cellWidth} viewMode={viewMode} />

                                    {filteredData.map((managerData) => (
                                        <ManagerRow
                                            key={getManagerName(managerData)}
                                            managerData={managerData}
                                            timelineStart={timeWindow.start}
                                            units={timeUnits}
                                            cellWidth={cellWidth}
                                            viewMode={viewMode}
                                            onProjectClick={setSelectedProject}
                                            onAllocationCommit={handleAllocationCommit}
                                            onRemoveManager={async (idOrName) => {
                                                if (typeof idOrName !== 'number') {
                                                    return;
                                                }

                                                const confirmDelete = window.confirm('Delete this manager and unassign their projects?');
                                                if (!confirmDelete) return;

                                                try {
                                                    await projectsService.deleteManager(idOrName);
                                                    await refreshTimelineCaches();
                                                } catch (error) {
                                                    window.alert(error.response?.data?.detail || error.message || 'Failed to delete manager');
                                                }
                                            }}
                                        />
                                    ))}

                                    {viewMode === 'Day' && timeUnits.some((unit) => unit.toDateString() === new Date().toDateString()) ? (
                                        <div
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                bottom: '-2000px',
                                                left: (() => {
                                                    const now = new Date();
                                                    const diffDays = Math.ceil((now - timeWindow.start) / (1000 * 60 * 60 * 24));
                                                    return 240 + (diffDays * cellWidth) + (cellWidth / 2);
                                                })(),
                                                width: '2px',
                                                background: 'var(--accent)',
                                                zIndex: 80,
                                                pointerEvents: 'none',
                                            }}
                                        />
                                    ) : null}
                                </div>
                            )}
                        </div>

                        <UnassignedTray
                            projects={unassignedProjects}
                            onProjectClick={setSelectedProject}
                            onDropReassign={async (id, newManagerId) => {
                                await handleAllocationCommit(id, { manager_id: newManagerId || null });
                            }}
                        />
                    </div>
                </div>
            </AppShell>
        </>
    );
}
