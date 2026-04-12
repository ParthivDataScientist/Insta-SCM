import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import projectsService from '../api/projects';

/**
 * Hook for managing Projects data with React Query
 * Handles caching, polling, and optimistic updates.
 */
export function useProjectData(params = {}) {
    const queryClient = useQueryClient();

    const invalidateProjectCaches = () => {
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        queryClient.invalidateQueries({ queryKey: ['projectStats'] });
        queryClient.invalidateQueries({ queryKey: ['designProjects'] });
        queryClient.invalidateQueries({ queryKey: ['designStats'] });
        queryClient.invalidateQueries({ queryKey: ['manager_timeline'] });
        queryClient.invalidateQueries({ queryKey: ['managers_list'] });
    };

    // 1. Fetching Projects
    const projectsQuery = useQuery({
        queryKey: ['projects', params],
        queryFn: () => projectsService.fetchProjects(params),
        refetchInterval: 5000, // 5s interval for real-time dashboard feel
    });

    // 2. Fetching Stats
    const statsQuery = useQuery({
        queryKey: ['projectStats', params],
        queryFn: () => projectsService.fetchProjectStats(params),
        refetchInterval: 10000, // Stats can be slightly slower
    });

    // 3. Mutation: Update Project (Stage or Data)
    const updateProjectMutation = useMutation({
        mutationFn: ({ id, data }) => projectsService.updateProject(id, data),
        // OPTIMISTIC UPDATE: Update cache instantly
        onMutate: async ({ id, data }) => {
            // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
            await queryClient.cancelQueries({ queryKey: ['projects'] });

            // Snapshot the previous value
            const previousProjects = queryClient.getQueriesData({ queryKey: ['projects'] });

            // Optimistically update to the new value
            previousProjects.forEach(([queryKey]) => {
                queryClient.setQueryData(queryKey, (old) =>
                    old ? old.map((project) => (project.id === id ? { ...project, ...data } : project)) : []
                );
            });

            // Return a context object with the snapshotted value
            return { previousProjects };
        },
        // If the mutation fails, use the context returned from onMutate to roll back
        onError: (err, newTodo, context) => {
            if (context?.previousProjects) {
                context.previousProjects.forEach(([queryKey, previousValue]) => {
                    queryClient.setQueryData(queryKey, previousValue);
                });
            }
        },
        // Always refetch after error or success:
        onSettled: () => {
            invalidateProjectCaches();
        },
    });

    // 4. Mutation: Delete Project
    const deleteProjectMutation = useMutation({
        mutationFn: (id) => projectsService.deleteProject(id),
        onSuccess: () => {
            invalidateProjectCaches();
        }
    });

    // 5. Mutation: Create Project
    const createProjectMutation = useMutation({
        mutationFn: (data) => projectsService.createProject(data),
        onSuccess: () => {
            invalidateProjectCaches();
        }
    });

    return {
        projects: projectsQuery.data || [],
        isLoading: projectsQuery.isLoading || statsQuery.isLoading,
        isError: projectsQuery.isError || statsQuery.isError,
        error: projectsQuery.error || statsQuery.error,
        stats: statsQuery.data || {},
        updateProject: updateProjectMutation.mutateAsync,
        deleteProject: deleteProjectMutation.mutateAsync,
        createProject: createProjectMutation.mutateAsync,
        refetch: projectsQuery.refetch
    };
}
