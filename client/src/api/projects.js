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
     * Fetches design-stage projects that have not yet been promoted to Win.
     */
    fetchDesignProjects: async (params = {}) => {
        const response = await apiClient.get('/api/v1/projects/designs', { params });
        return response.data;
    },

    /**
     * Fetches Design Management KPIs.
     */
    fetchDesignStats: async (params = {}) => {
        const response = await apiClient.get('/api/v1/projects/designs/stats', { params });
        return response.data;
    },

    /**
     * Fetches the simulated CRM feed without persisting it.
     */
    fetchCrmDesignFeed: async () => {
        const response = await apiClient.get('/api/v1/projects/crm/designs');
        return response.data;
    },

    /**
     * Upserts the simulated CRM design feed into DashboardProject.
     */
    syncCrmDesignFeed: async () => {
        const response = await apiClient.post('/api/v1/projects/crm/designs/sync');
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

    fetchProjectLinks: async (projectId) => {
        const response = await apiClient.get(`/api/v1/projects/${projectId}/links`);
        return response.data;
    },

    createProjectLink: async (projectId, data) => {
        const response = await apiClient.post(`/api/v1/projects/${projectId}/links`, data);
        return response.data;
    },

    updateProjectLink: async (projectId, linkId, data) => {
        const response = await apiClient.put(`/api/v1/projects/${projectId}/links/${linkId}`, data);
        return response.data;
    },

    deleteProjectLink: async (projectId, linkId) => {
        const response = await apiClient.delete(`/api/v1/projects/${projectId}/links/${linkId}`);
        return response.data;
    },

    /**
     * Promotes a design-stage project into the execution pipeline.
     */
    convertDesignToProject: async (id) => {
        const response = await apiClient.post(`/api/v1/projects/designs/${id}/win`);
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
    checkAvailability: async (startDate, endDate = null, managerId = null, projectId = null) => {
        const params = { start_date: startDate };
        if (endDate) params.end_date = endDate;
        if (managerId) params.manager_id = managerId;
        if (projectId) params.project_id = projectId;
        
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
