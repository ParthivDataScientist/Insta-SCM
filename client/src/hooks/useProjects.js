import { useState } from 'react';
import { useGlobalDateRange } from '../contexts/GlobalDateRangeContext';
import { useProjectData } from './useProjectData';
import { isWonProject, normalizeProjectStage } from '../utils/projectStatus';

/**
 * Hook for managing Projects UI state (filters, search)
 * Delegates data fetching and updates to useProjectData (React Query).
 */
export function useProjects() {
    const { dateRange, setDateRange } = useGlobalDateRange();
    const { 
        projects, stats, isLoading, isError, error, 
        updateProject, deleteProject, createProject, refetch 
    } = useProjectData();

    // Filtering UI State
    const [filterStage, setFilterStage] = useState('All');
    const [filterBranch, setFilterBranch] = useState('All');
    const [filterPM, setFilterPM] = useState('All');
    const [filterCity, setFilterCity] = useState('All');
    const [filterClient, setFilterClient] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

    // Filtering Logic (Memoized by React Query's projects stability)
    const filteredProjects = projects.filter(p => {
        // Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const matchesSearch = (p.project_name || '').toLowerCase().includes(q) ||
                                  (p.event_name || '').toLowerCase().includes(q) ||
                                  (p.crm_project_id || '').toLowerCase().includes(q) ||
                                  (p.board_stage || '').toLowerCase().includes(q) ||
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
        if (filterStatus !== 'All' && p.board_stage !== filterStatus) return false;

        // Date Range
        if ((dateRange.start || dateRange.end) && !p.event_start_date) {
            return false;
        }
        if (dateRange.start && p.event_start_date) {
            if (new Date(p.event_start_date) < new Date(dateRange.start)) return false;
        }
        if (dateRange.end && p.event_start_date) {
            if (new Date(p.event_start_date) > new Date(dateRange.end)) return false;
        }

        return true;
    });

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
