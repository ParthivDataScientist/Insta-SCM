import apiClient from './apiClient';

/**
 * Shipments API Service
 */
const shipmentsService = {
    fetchShipments: async () => {
        const response = await apiClient.get('/api/v1/shipments/');
        return response.data;
    },

    fetchArchivedShipments: async () => {
        const response = await apiClient.get('/api/v1/shipments/archived/');
        return response.data;
    },

    fetchStats: async () => {
        const response = await apiClient.get('/api/v1/shipments/stats');
        return response.data;
    },

    fetchShipment: async (id) => {
        const response = await apiClient.get(`/api/v1/shipments/${id}`);
        return response.data;
    },

    fetchProjectShipments: async (projectId) => {
        const response = await apiClient.get(`/api/v1/shipments/project/${projectId}`);
        return response.data;
    },

    previewTrackShipment: async (trackingNumber, options = {}) => {
        const params = {};
        if (options.masterTrackingNumber) {
            params.master_tracking_number = options.masterTrackingNumber;
        }
        const response = await apiClient.get(`/api/v1/shipments/track/${trackingNumber}/preview`, { params });
        return response.data;
    },

    trackShipment: async (trackingNumber, payload = {}) => {
        const response = await apiClient.post(`/api/v1/shipments/track/${trackingNumber}`, payload);
        return response.data;
    },

    refreshShipments: async (shipmentIds = null, options = {}) => {
        const { includeChildren = false, timeoutMs = 120000 } = options;
        const payload = shipmentIds && shipmentIds.length > 0
            ? { shipment_ids: shipmentIds, include_children: includeChildren }
            : { shipment_ids: null, include_children: includeChildren };
        const response = await apiClient.post('/api/v1/shipments/refresh', payload, {
            timeout: timeoutMs,
        });
        return response.data;
    },

    deleteShipment: async (id) => {
        const response = await apiClient.delete(`/api/v1/shipments/${id}`);
        return response.data;
    },

    archiveShipment: async (id) => {
        const response = await apiClient.patch(`/api/v1/shipments/${id}/archive`);
        return response.data;
    },

    batchArchiveShipments: async (ids, archive) => {
        const response = await apiClient.post('/api/v1/shipments/batch/archive', { 
            shipment_ids: ids, 
            archive 
        });
        return response.data;
    },

    batchDeleteShipments: async (ids) => {
        const response = await apiClient.post('/api/v1/shipments/batch/delete', { 
            shipment_ids: ids 
        });
        return response.data;
    },

    importExcel: async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await apiClient.post('/api/v1/shipments/import-excel', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    exportExcel: async (shipmentIds = []) => {
        const params = Array.isArray(shipmentIds) && shipmentIds.length > 0
            ? { shipment_ids: shipmentIds.join(',') }
            : {};
        const response = await apiClient.get('/api/v1/shipments/export-excel', {
            params,
            responseType: 'blob'
        });
        return response.data;
    }
};

export default shipmentsService;
