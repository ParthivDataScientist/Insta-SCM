import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import projectsService from '../api/projects';
import { useGlobalDateRange } from '../contexts/GlobalDateRangeContext';
import { normalizeProjectStage } from '../utils/projectStatus';

export function useDesignProjects() {
    const queryClient = useQueryClient();
    const { dateRange } = useGlobalDateRange();
    const [filterStatus, setFilterStatus] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

    const designQuery = useQuery({
        queryKey: ['designProjects'],
        queryFn: projectsService.fetchDesignProjects,
        refetchInterval: 5000,
    });

    const designStatsQuery = useQuery({
        queryKey: ['designStats'],
        queryFn: projectsService.fetchDesignStats,
        refetchInterval: 10000,
    });

    const invalidateCaches = () => {
        queryClient.invalidateQueries({ queryKey: ['designProjects'] });
        queryClient.invalidateQueries({ queryKey: ['designStats'] });
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        queryClient.invalidateQueries({ queryKey: ['projectStats'] });
        queryClient.invalidateQueries({ queryKey: ['manager_timeline'] });
    };

    const updateDesignMutation = useMutation({
        mutationFn: async ({ id, data }) => {
            if (normalizeProjectStage(data.stage) === 'Win') {
                return projectsService.convertDesignToProject(id);
            }
            return projectsService.updateProject(id, data);
        },
        onSuccess: invalidateCaches,
    });

    const syncCrmMutation = useMutation({
        mutationFn: projectsService.syncCrmDesignFeed,
        onSuccess: invalidateCaches,
    });

    const designProjects = designQuery.data || [];

    const filteredDesignProjects = useMemo(() => {
        return designProjects.filter((project) => {
            if (filterStatus !== 'All' && normalizeProjectStage(project.stage) !== filterStatus) {
                return false;
            }

            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const matchesSearch =
                    (project.crm_project_id || '').toLowerCase().includes(q) ||
                    (project.project_name || '').toLowerCase().includes(q) ||
                    (project.venue || '').toLowerCase().includes(q) ||
                    (project.area || '').toLowerCase().includes(q);

                if (!matchesSearch) return false;
            }

            if ((dateRange.start || dateRange.end) && !project.event_start_date) {
                return false;
            }
            if (dateRange.start && new Date(project.event_start_date) < new Date(dateRange.start)) {
                return false;
            }
            if (dateRange.end && new Date(project.event_start_date) > new Date(dateRange.end)) {
                return false;
            }

            return true;
        });
    }, [dateRange.end, dateRange.start, designProjects, filterStatus, searchQuery]);

    return {
        designProjects,
        filteredDesignProjects,
        designStats: designStatsQuery.data || {},
        loading: designQuery.isLoading || designStatsQuery.isLoading,
        syncing: syncCrmMutation.isPending,
        error: designQuery.error?.message || designStatsQuery.error?.message || null,
        filterStatus,
        setFilterStatus,
        searchQuery,
        setSearchQuery,
        updateDesignStatus: updateDesignMutation.mutateAsync,
        syncCrmFeed: syncCrmMutation.mutateAsync,
        loadData: async () => {
            await Promise.all([designQuery.refetch(), designStatsQuery.refetch()]);
        },
    };
}
