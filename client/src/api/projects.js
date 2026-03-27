import apiClient from './apiClient';

/**
 * Projects API Service
 */
const projectsService = {
    /**
     * Fetches all projects.
     */
    fetchProjects: async () => {
        const response = await apiClient.get('/api/v1/projects/');
        return response.data;
    },

    /**
     * Fetches project statistics for dashboard KPIs.
     */
    fetchProjectStats: async () => {
        const response = await apiClient.get('/api/v1/projects/stats');
        return response.data;
    },

    /**
     * Creates a new project.
     */
    createProject: async (data) => {
        const response = await apiClient.post('/api/v1/projects/', data);
        return response.data;
    },

    /**
     * Updates an existing project.
     */
    updateProject: async (id, data) => {
        const response = await apiClient.put(`/api/v1/projects/${id}`, data);
        return response.data;
    },

    /**
     * Deletes a project.
     */
    deleteProject: async (id) => {
        const response = await apiClient.delete(`/api/v1/projects/${id}`);
        return response.data;
    }
};

export default projectsService;
