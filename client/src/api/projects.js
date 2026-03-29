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
    fetchManagerProjects: async (managerName) => {
        const response = await apiClient.get(`/api/v1/projects/manager/${encodeURIComponent(managerName)}`);
        return response.data;
    },

    /**
     * Checks availability for a manager or all managers.
     */
    checkAvailability: async (startDate, endDate = null, managerName = null) => {
        const params = { start_date: startDate };
        if (endDate) params.end_date = endDate;
        if (managerName) params.manager_name = managerName;
        
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
     * Fetches all managers.
     */
    fetchManagers: async () => {
        const response = await apiClient.get('/api/v1/managers/');
        return response.data;
    },

    /**
     * Creates a new manager.
     */
    createManager: async (data) => {
        const response = await apiClient.post('/api/v1/managers/', data);
        return response.data;
    },

    /**
     * Deletes a manager by ID.
     */
    deleteManager: async (id) => {
        const response = await apiClient.delete(`/api/v1/managers/${id}`);
        return response.data;
    },

    /**
     * Updates an allocation.
     */
    updateAllocation: async (id, data) => {
        const response = await apiClient.put(`/api/v1/manager_allocations/${id}`, data);
        return response.data;
    }
};

export default projectsService;
