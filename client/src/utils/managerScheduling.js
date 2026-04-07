import { formatDateDisplay, formatDateRangeDisplay } from './dateUtils';

export function resolveProjectSchedule(project) {
    const start =
        project?.allocation_start_date ||
        project?.dispatch_date ||
        project?.event_start_date ||
        '';

    const end =
        project?.allocation_end_date ||
        project?.dismantling_date ||
        project?.event_end_date ||
        start ||
        '';

    return { start, end };
}

export function getManagerAvailabilityResult(resultMap, managerId) {
    if (!resultMap || !managerId) {
        return null;
    }

    return resultMap[String(managerId)] || resultMap[managerId] || null;
}

export function buildConflictWarningMessage(managerName, conflicts, startDate, endDate) {
    const windowLabel = formatDateRangeDisplay(startDate, endDate || startDate);
    const items = (conflicts || [])
        .slice(0, 4)
        .map((conflict) => {
            const conflictStart = conflict.allocation_start_date || conflict.dispatch_date || conflict.event_start_date;
            const conflictEnd = conflict.allocation_end_date || conflict.dismantling_date || conflict.event_end_date || conflictStart;
            return `- ${conflict.project_name} (${formatDateDisplay(conflictStart) || conflictStart} to ${formatDateDisplay(conflictEnd) || conflictEnd})`;
        })
        .join('\n');

    return `Schedule overlap detected for ${managerName || 'this manager'}.\n\nRequested window: ${windowLabel}\n\nConflicts:\n${items}\n\nDo you want to continue anyway?`;
}

export function buildManagerAvailabilityGroups(managers, availabilityMap) {
    const managerEntries = (managers || []).map((manager) => {
        const availability =
            availabilityMap?.[String(manager.id)] ||
            availabilityMap?.[manager.id] ||
            {
                available: true,
                conflicts: [],
                available_windows: [],
            };

        return {
            manager,
            availability,
            conflicts: availability.conflicts || [],
            available: availability.available !== false,
        };
    });

    return {
        availableManagers: managerEntries.filter((entry) => entry.available),
        busyManagers: managerEntries.filter((entry) => !entry.available),
    };
}
