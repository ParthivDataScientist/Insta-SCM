import apiClient from '../../api/apiClient';

export const getApiErrorMessage = (error: unknown, fallback = 'Something went wrong'): string => {
    if (typeof error === 'string' && error.trim()) return error;
    if (error && typeof error === 'object') {
        const apiError = error as {
            response?: { data?: { detail?: string; message?: string } };
            message?: string;
        };
        const detail = apiError.response?.data?.detail || apiError.response?.data?.message;
        if (detail) return detail;
        if (apiError.message) return apiError.message;
    }
    return fallback;
};

const shipmentApi = {
    async fetchShipments() {
        const response = await apiClient.get('/api/v1/shipments/');
        return response.data;
    },

    async fetchArchivedShipments() {
        const response = await apiClient.get('/api/v1/shipments/archived/');
        return response.data;
    },

    async fetchStats() {
        const response = await apiClient.get('/api/v1/shipments/stats');
        return response.data;
    },

    async fetchShipment(id: number) {
        const response = await apiClient.get(`/api/v1/shipments/${id}`);
        return response.data;
    },

    async previewTrackShipment(trackingNumber: string, options: { masterTrackingNumber?: string } = {}) {
        const params: Record<string, string> = {};
        if (options.masterTrackingNumber) {
            params.master_tracking_number = options.masterTrackingNumber;
        }
        const response = await apiClient.get(`/api/v1/shipments/track/${trackingNumber}/preview`, { params });
        return response.data;
    },

    async trackShipment(trackingNumber: string, payload: Record<string, unknown> = {}) {
        const response = await apiClient.post(`/api/v1/shipments/track/${trackingNumber}`, payload);
        return response.data;
    },

    async refreshShipments(shipmentIds: number[] | null = null, options: { includeChildren?: boolean; timeoutMs?: number } = {}) {
        const { includeChildren = false, timeoutMs = 120000 } = options;
        const payload = shipmentIds && shipmentIds.length > 0
            ? { shipment_ids: shipmentIds, include_children: includeChildren }
            : { shipment_ids: null, include_children: includeChildren };
        const response = await apiClient.post('/api/v1/shipments/refresh', payload, {
            timeout: timeoutMs,
        });
        return response.data;
    },

    async deleteShipment(id: number) {
        const response = await apiClient.delete(`/api/v1/shipments/${id}`);
        return response.data;
    },

    async archiveShipment(id: number) {
        const response = await apiClient.patch(`/api/v1/shipments/${id}/archive`);
        return response.data;
    },

    async batchArchiveShipments(ids: number[], archive: boolean) {
        const response = await apiClient.post('/api/v1/shipments/batch/archive', {
            shipment_ids: ids,
            archive,
        });
        return response.data;
    },

    async batchDeleteShipments(ids: number[]) {
        const response = await apiClient.post('/api/v1/shipments/batch/delete', {
            shipment_ids: ids,
        });
        return response.data;
    },

    async importExcel(file: File) {
        const formData = new FormData();
        formData.append('file', file);
        const response = await apiClient.post('/api/v1/shipments/import-excel', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    },

    async exportExcel(shipmentIds: number[] = []) {
        const params = Array.isArray(shipmentIds) && shipmentIds.length > 0
            ? { shipment_ids: shipmentIds.join(',') }
            : {};
        const response = await apiClient.get('/api/v1/shipments/export-excel', {
            params,
            responseType: 'blob',
        });
        return response.data;
    },
};

export default shipmentApi;
