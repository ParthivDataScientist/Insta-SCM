import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import projectsService from '../api/projects';

/**
 * Hook for managing Projects data with React Query
 * Handles caching, polling, and optimistic updates.
 */
export function useProjectData() {
    const queryClient = useQueryClient();

    // 1. Fetching Projects
    const projectsQuery = useQuery({
        queryKey: ['projects'],
        queryFn: projectsService.fetchProjects,
        refetchInterval: 5000, // 5s interval for real-time dashboard feel
    });

    // 2. Fetching Stats
    const statsQuery = useQuery({
        queryKey: ['projectStats'],
        queryFn: projectsService.fetchProjectStats,
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
            const previousProjects = queryClient.getQueryData(['projects']);

            // Optimistically update to the new value
            queryClient.setQueryData(['projects'], (old) => 
                old ? old.map(p => p.id === id ? { ...p, ...data } : p) : []
            );

            // Return a context object with the snapshotted value
            return { previousProjects };
        },
        // If the mutation fails, use the context returned from onMutate to roll back
        onError: (err, newTodo, context) => {
            if (context?.previousProjects) {
                queryClient.setQueryData(['projects'], context.previousProjects);
            }
        },
        // Always refetch after error or success:
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            queryClient.invalidateQueries({ queryKey: ['projectStats'] });
        },
    });

    // 4. Mutation: Delete Project
    const deleteProjectMutation = useMutation({
        mutationFn: (id) => projectsService.deleteProject(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            queryClient.invalidateQueries({ queryKey: ['projectStats'] });
        }
    });

    // 5. Mutation: Create Project
    const createProjectMutation = useMutation({
        mutationFn: (data) => projectsService.createProject(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            queryClient.invalidateQueries({ queryKey: ['projectStats'] });
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
