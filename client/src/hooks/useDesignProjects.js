import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useGlobalDateRange } from '../contexts/GlobalDateRangeContext';
import projectsService from '../api/projects';

const STATUS_FILTERS = ['all', 'pending', 'in_progress', 'changes', 'won', 'lost'];

function buildParams(searchParams) {
    const status = searchParams.get('status') || 'all';
    const search = searchParams.get('q') || '';
    const client_id = searchParams.get('clientId') || '';
    const city = searchParams.get('city') || '';
    const date_field = searchParams.get('dateField') || 'show';

    return {
        status,
        search,
        client_id: client_id || undefined,
        city: city || undefined,
        date_field,
    };
}

export function useDesignProjects() {
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();
    const { dateRange } = useGlobalDateRange();
    const apiParams = useMemo(() => ({
        ...buildParams(searchParams),
        start_date: dateRange.start || undefined,
        end_date: dateRange.end || undefined,
    }), [dateRange.end, dateRange.start, searchParams]);
    const activeKpi = searchParams.get('kpi') || 'all';

    const designQuery = useQuery({
        queryKey: ['designProjects', apiParams],
        queryFn: () => projectsService.fetchDesignProjects(apiParams),
        refetchInterval: 5000,
    });

    const designStatsQuery = useQuery({
        queryKey: ['designStats', apiParams],
        queryFn: () => projectsService.fetchDesignStats(apiParams),
        refetchInterval: 10000,
    });

    const clientsQuery = useQuery({
        queryKey: ['clients'],
        queryFn: projectsService.fetchClients,
        staleTime: 60000,
    });

    const updateParams = (next) => {
        const updated = new URLSearchParams(searchParams);
        Object.entries(next).forEach(([key, value]) => {
            if (value === undefined || value === null || value === '' || value === 'all') {
                updated.delete(key);
            } else {
                updated.set(key, value);
            }
        });
        setSearchParams(updated, { replace: true });
    };

    const invalidateCaches = () => {
        queryClient.invalidateQueries({ queryKey: ['designProjects'] });
        queryClient.invalidateQueries({ queryKey: ['designStats'] });
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        queryClient.invalidateQueries({ queryKey: ['projectStats'] });
        queryClient.invalidateQueries({ queryKey: ['manager_timeline'] });
    };

    const updateDesignMutation = useMutation({
        mutationFn: async ({ id, data }) => {
            if (data.status === 'won') {
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
    const cityOptions = useMemo(
        () => ['all', ...new Set(designProjects.map((project) => project.city).filter(Boolean).map((city) => city.trim()))],
        [designProjects]
    );

    const tableProjects = useMemo(() => {
        if (activeKpi === 'open') {
            return designProjects.filter((project) => !['won', 'lost'].includes(project.status));
        }
        if (activeKpi === 'overdue') {
            return designProjects.filter((project) => {
                const anchor = project.event_start_date || project.booking_date;
                return anchor && !['won', 'lost'].includes(project.status) && new Date(anchor) < new Date(new Date().toISOString().split('T')[0]);
            });
        }
        if (STATUS_FILTERS.includes(activeKpi) && activeKpi !== 'all') {
            return designProjects.filter((project) => project.status === activeKpi);
        }
        return designProjects;
    }, [activeKpi, designProjects]);

    const overdueCount = useMemo(
        () => designProjects.filter((project) => {
            const anchor = project.event_start_date || project.booking_date;
            return anchor && !['won', 'lost'].includes(project.status) && new Date(anchor) < new Date(new Date().toISOString().split('T')[0]);
        }).length,
        [designProjects]
    );

    return {
        designProjects,
        tableProjects,
        designStats: {
            ...(designStatsQuery.data || {}),
            overdue_count: overdueCount,
        },
        clients: clientsQuery.data || [],
        cityOptions,
        loading: designQuery.isLoading || designStatsQuery.isLoading,
        syncing: syncCrmMutation.isPending,
        error: designQuery.error?.message || designStatsQuery.error?.message || null,
        filters: {
            status: apiParams.status,
            search: apiParams.search,
            clientId: searchParams.get('clientId') || 'all',
            city: searchParams.get('city') || 'all',
            dateField: apiParams.date_field,
            activeKpi,
        },
        setFilterStatus: (value) => updateParams({ status: value }),
        setSearchQuery: (value) => updateParams({ q: value }),
        setClientId: (value) => updateParams({ clientId: value }),
        setCity: (value) => updateParams({ city: value }),
        setDateField: (value) => updateParams({ dateField: value }),
        setActiveKpi: (value) => updateParams({ kpi: value }),
        clearFilters: () => setSearchParams(new URLSearchParams(), { replace: true }),
        updateDesignStatus: updateDesignMutation.mutateAsync,
        syncCrmFeed: syncCrmMutation.mutateAsync,
        loadData: async () => Promise.all([designQuery.refetch(), designStatsQuery.refetch()]),
    };
}
