import { useMemo } from 'react';
import { useGlobalDateRange } from '../contexts/GlobalDateRangeContext';
import { useProjectData } from './useProjectData';
import { isWonProject, normalizeBoardStage, normalizeProjectPriority, normalizeProjectStage, sortProjectsByPriority } from '../utils/projectStatus';
import { usePersistentState } from './usePersistentState';

/**
 * Hook for managing Projects UI state (filters, search)
 * Delegates data fetching and updates to useProjectData (React Query).
 */
export function useProjects() {
    const { dateRange, setDateRange } = useGlobalDateRange();
    const queryParams = useMemo(() => ({
        start_date: dateRange.start || undefined,
        end_date: dateRange.end || undefined,
        date_context: 'execution',
    }), [dateRange.end, dateRange.start]);
    const { 
        projects, stats, isLoading, isError, error, 
        updateProject, deleteProject, createProject, refetch 
    } = useProjectData(queryParams);

    // Filtering UI State
    const [filterStage, setFilterStage] = usePersistentState('insta.projects.filterStage', 'All');
    const [filterBranch, setFilterBranch] = usePersistentState('insta.projects.filterBranch', 'All');
    const [filterPM, setFilterPM] = usePersistentState('insta.projects.filterPM', 'All');
    const [filterCity, setFilterCity] = usePersistentState('insta.projects.filterCity', 'All');
    const [filterClient, setFilterClient] = usePersistentState('insta.projects.filterClient', 'All');
    const [filterStatus, setFilterStatus] = usePersistentState('insta.projects.filterStatus', 'All');
    const [filterPriority, setFilterPriority] = usePersistentState('insta.projects.filterPriority', 'All');
    const [searchQuery, setSearchQuery] = usePersistentState('insta.projects.searchQuery', '');

    // Filtering Logic (Memoized by React Query's projects stability)
    const filteredProjects = useMemo(() => projects.filter(p => {
        // Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const matchesSearch = (p.project_name || '').toLowerCase().includes(q) ||
                                  (p.event_name || '').toLowerCase().includes(q) ||
                                  (p.crm_project_id || '').toLowerCase().includes(q) ||
                                  (p.venue || '').toLowerCase().includes(q) ||
                                  (p.branch || '').toLowerCase().includes(q) ||
                                  (p.city || '').toLowerCase().includes(q) ||
                                  normalizeBoardStage(p.board_stage).toLowerCase().includes(q) ||
                                  normalizeProjectPriority(p.priority).includes(q) ||
                                  (p.project_manager || '').toLowerCase().includes(q);
            if (!matchesSearch) return false;
        }

        // KPI Filter (Stage)
        if (filterStage !== 'All') {
            if (filterStage === 'Open') {
                if (isWonProject(p.stage)) return false;
            } else if (filterStage === 'Confirmed') {
                if (!isWonProject(p.stage)) return false;
            } else {
                if (normalizeProjectStage(p.stage) !== normalizeProjectStage(filterStage)) return false;
            }
        }

        // Dropdown Filters
        if (filterBranch !== 'All' && p.branch !== filterBranch) return false;
        if (filterPM !== 'All' && p.project_manager !== filterPM) return false;
        if (filterCity !== 'All' && p.city !== filterCity) return false;
        if (filterClient !== 'All' && p.client !== filterClient) return false;
        if (filterStatus !== 'All' && normalizeBoardStage(p.board_stage) !== filterStatus) return false;
        if (filterPriority !== 'All' && normalizeProjectPriority(p.priority) !== filterPriority.toLowerCase()) return false;

        return true;
    }).sort(sortProjectsByPriority), [
        filterBranch,
        filterCity,
        filterClient,
        filterPM,
        filterPriority,
        filterStage,
        filterStatus,
        projects,
        searchQuery,
    ]);

    const updateBoardStage = async (id, stage) => {
        return updateProject({ id, data: { board_stage: stage } });
    };

    const updateProjectFull = async (id, data) => {
        return updateProject({ id, data });
    };

    return {
        projects,
        filteredProjects,
        stats,
        loading: isLoading,
        error: error?.message || (isError ? "Failed to load data" : null),
        loadData: refetch,
        filterStage,
        setFilterStage,
        filterBranch,
        setFilterBranch,
        filterPM,
        setFilterPM,
        filterCity,
        setFilterCity,
        filterClient,
        setFilterClient,
        filterStatus,
        setFilterStatus,
        filterPriority,
        setFilterPriority,
        dateRange,
        setDateRange,
        searchQuery,
        setSearchQuery,
        updateBoardStage,
        updateProjectFull,
        createProject,
        deleteProject
    };
}
