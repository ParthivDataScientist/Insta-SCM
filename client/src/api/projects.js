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
    },

    /**
     * Fetches all projects for a specific manager.
     */
    fetchManagerProjects: async (managerId) => {
        const response = await apiClient.get(`/api/v1/projects/manager/${managerId}`);
        return response.data;
    },

    /**
     * Checks availability for a manager or all managers.
     */
    checkAvailability: async (startDate, endDate = null, managerId = null) => {
        const params = { start_date: startDate };
        if (endDate) params.end_date = endDate;
        if (managerId) params.manager_id = managerId;
        
        const response = await apiClient.get('/api/v1/projects/availability-check', { params });
        return response.data;
    },

    /**
     * Fetches grouped project data for the Gantt timeline.
     */
    fetchTimeline: async () => {
        const response = await apiClient.get('/api/v1/projects/timeline');
        return response.data;
    },

    /**
     * Fetches the list of project managers.
     */
    fetchManagers: async () => {
        const response = await apiClient.get('/api/v1/projects/pm-list');
        return response.data;
    },

    /**
     * Fetches the list of clients.
     */
    fetchClients: async () => {
        const response = await apiClient.get('/api/v1/projects/client-list');
        return response.data;
    },

    /**
     * Creates a new project manager account.
     */
    createManager: async (data) => {
        const response = await apiClient.post('/api/v1/projects/managers', data);
        return response.data;
    },

    /**
     * Deletes a project manager account.
     */
    deleteManager: async (id) => {
        const response = await apiClient.delete(`/api/v1/projects/managers/${id}`);
        return response.data;
    }
};

export default projectsService;
