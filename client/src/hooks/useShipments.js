import { useState, useCallback, useEffect, useMemo } from 'react';
import shipmentsService from '../api/shipments';

/**
 * Custom hook encapsulating all shipment data-fetching, filtering, and state.
 * Updated to use shipmentsService (Axios-based).
 */
export function useShipments() {
    const [shipments, setShipments] = useState([]);
    const [stats, setStats] = useState({ total: 0, transit: 0, delivered: 0, exceptions: 0 });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    // Filter state
    const [filter, setFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [carrierFilter, setCarrierFilter] = useState('All');
    const [dateFilter, setDateFilter] = useState('All');
    const [isArchivedView, setIsArchivedView] = useState(false);



    const getErrorMessage = useCallback((err) => {
        return err?.response?.data?.detail || err?.message || 'Something went wrong';
    }, []);

    const clearCache = useCallback(() => {
        sessionStorage.removeItem('shipments_active');
        sessionStorage.removeItem('shipments_archived');
        sessionStorage.removeItem('shipments_stats');
    }, []);

    const loadData = useCallback(async (includeArchived = null, options = {}) => {
        const { silent = false, forceRefresh = false } = options;
        const archivedState = includeArchived !== null ? includeArchived : isArchivedView;
        if (includeArchived !== null) setIsArchivedView(archivedState);
        
        const shipmentsCacheKey = archivedState ? 'shipments_archived' : 'shipments_active';
        const statsCacheKey = 'shipments_stats';

        if (!forceRefresh) {
            const cachedShipments = sessionStorage.getItem(shipmentsCacheKey);
            const cachedStats = sessionStorage.getItem(statsCacheKey);
            if (cachedShipments && cachedStats) {
                setShipments(JSON.parse(cachedShipments));
                setStats(JSON.parse(cachedStats));
                setLoading(false);
                setError(null);
                return;
            }
        }
        
        if (!silent) setLoading(true);
        setError(null);
        try {
            let [shipmentsData, statsData] = await Promise.all([
                archivedState ? shipmentsService.fetchArchivedShipments() : shipmentsService.fetchShipments(),
                shipmentsService.fetchStats(),
            ]);

            sessionStorage.setItem(shipmentsCacheKey, JSON.stringify(shipmentsData));
            sessionStorage.setItem(statsCacheKey, JSON.stringify(statsData));

            setShipments(shipmentsData);
            setStats(statsData);
        } catch (err) {
            setError(getErrorMessage(err));
            console.error('Failed to load data from backend:', err);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [getErrorMessage, isArchivedView]);

    useEffect(() => { loadData(false); }, [loadData]); // Initial load default to dashboard

    const archiveShipment = useCallback(async (id) => {
        clearCache();
        // Optimistic Update
        setShipments(prev => prev.filter(s => s.id !== id));
        try {
            await shipmentsService.archiveShipment(id);
            // Refresh stats in background
            shipmentsService.fetchStats().then(setStats).catch(console.error);
        } catch (err) {
            setError(getErrorMessage(err));
            console.error('Failed to archive shipment:', err);
            loadData(null, { forceRefresh: true }); // Rollback on error
        }
    }, [getErrorMessage, loadData, clearCache]);

    const deleteShipment = useCallback(async (id) => {
        clearCache();
        setError(null);
        try {
            const result = await shipmentsService.deleteShipment(id);
            const deletedIds = Array.isArray(result?.deleted_ids) && result.deleted_ids.length > 0
                ? result.deleted_ids
                : [id];
            setShipments((prev) => prev.filter((s) => !deletedIds.includes(s.id)));
            shipmentsService.fetchStats().then(setStats).catch(console.error);
        } catch (err) {
            setError(getErrorMessage(err));
            console.error('Failed to delete shipment:', err);
            loadData(null, { forceRefresh: true }); // Recovery
        }
    }, [getErrorMessage, loadData, clearCache]);

    const batchArchive = useCallback(async (ids, archive) => {
        clearCache();
        // Optimistic Update
        setShipments(prev => prev.filter(s => !ids.includes(s.id)));
        try {
            await shipmentsService.batchArchiveShipments(ids, archive);
            shipmentsService.fetchStats().then(setStats).catch(console.error);
        } catch (err) {
            setError(getErrorMessage(err));
            loadData(null, { forceRefresh: true });
        }
    }, [getErrorMessage, loadData, clearCache]);

    const batchDelete = useCallback(async (ids) => {
        clearCache();
        setError(null);
        try {
            const result = await shipmentsService.batchDeleteShipments(ids);
            const deletedIds = Array.isArray(result?.deleted_ids) && result.deleted_ids.length > 0
                ? result.deleted_ids
                : ids;
            setShipments((prev) => prev.filter((s) => !deletedIds.includes(s.id)));
            shipmentsService.fetchStats().then(setStats).catch(console.error);
        } catch (err) {
            setError(getErrorMessage(err));
            console.error('Failed to batch delete shipments:', err);
            loadData(null, { forceRefresh: true });
        }
    }, [getErrorMessage, loadData, clearCache]);

    const importExcel = useCallback(async (file) => {
        clearCache();
        setLoading(true);
        setError(null);
        try {
            await shipmentsService.importExcel(file);
            await loadData(null, { forceRefresh: true });
        } catch (err) {
            setError(getErrorMessage(err));
            console.error('Failed to import Excel file:', err);
        } finally {
            setLoading(false);
        }
    }, [getErrorMessage, loadData, clearCache]);

    const refreshTracking = useCallback(async (shipmentIds = null) => {
        setRefreshing(true);
        setError(null);
        try {
            const result = await shipmentsService.refreshShipments(shipmentIds, {
                includeChildren: true,
                timeoutMs: 120000,
            });
            await loadData(null, { silent: true, forceRefresh: true });
            if (result.failed > 0) {
                const message = `Refreshed ${result.refreshed} shipment(s), but ${result.failed} could not be re-synced.`;
                setError(message);
            } else {
                alert("Done");
            }
            return result;
        } catch (err) {
            const message = getErrorMessage(err);
            setError(message);
            console.error('Failed to refresh shipments:', err);
            return {
                requested: 0,
                refreshed: 0,
                failed: 1,
                errors: [message],
            };
        } finally {
            setRefreshing(false);
        }
    }, [getErrorMessage, loadData]);

    const filteredShipments = useMemo(() => {
        return shipments.filter(item => {
            const matchesStatus =
                filter === 'All' ||
                item.status === filter ||
                (filter === 'Active' && item.status !== 'Delivered') ||
                (filter === 'Exception' && (item.status || '').toLowerCase().includes('exception'));

            const matchesCarrier = carrierFilter === 'All' || item.carrier === carrierFilter;

            let matchesDate = true;
            if (dateFilter !== 'All') {
                const createdDate = new Date(item.created_at);
                const now = new Date();
                if (dateFilter === 'Today') {
                    matchesDate = createdDate.toDateString() === now.toDateString();
                } else if (dateFilter === 'Last 7 Days') {
                    const sevenDaysAgo = new Date();
                    sevenDaysAgo.setDate(now.getDate() - 7);
                    sevenDaysAgo.setHours(0, 0, 0, 0);
                    matchesDate = createdDate >= sevenDaysAgo;
                }
            }

            const q = searchQuery.toLowerCase();
            const matchesSearch =
                !q ||
                (item.tracking_number || '').toLowerCase().includes(q) ||
                (item.carrier || '').toLowerCase().includes(q) ||
                (item.recipient || '').toLowerCase().includes(q) ||
                (item.exhibition_name || '').toLowerCase().includes(q) ||
                (item.project_name || '').toLowerCase().includes(q) ||
                (item.project_client_name || '').toLowerCase().includes(q) ||
                (item.items || '').toLowerCase().includes(q) ||
                (item.status || '').toLowerCase().includes(q);

            return matchesStatus && matchesCarrier && matchesDate && matchesSearch;
        });
    }, [filter, carrierFilter, dateFilter, searchQuery, shipments]);

    // Selection state
    const [selectedIds, setSelectedIds] = useState([]);

    const handleSelectAll = useCallback(() => {
        if (selectedIds.length === filteredShipments.length && filteredShipments.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredShipments.map(s => s.id).filter(id => id != null));
        }
    }, [filteredShipments, selectedIds]);

    // Reset selection when filters or view changes to prevent accidental batch actions
    useEffect(() => {
        setSelectedIds([]);
    }, [filter, searchQuery, carrierFilter, dateFilter, isArchivedView]);

    const exportExcel = useCallback(async (shipmentIds = null) => {
        setLoading(true);
        setError(null);
        try {
            const ids = Array.isArray(shipmentIds) ? shipmentIds : [];
            const blob = await shipmentsService.exportExcel(ids);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `shipments_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }, [getErrorMessage]);

    const updateShipment = useCallback((updatedShipment) => {
        clearCache();
        setShipments((prev) =>
            prev.map((s) => (s.id === updatedShipment.id ? updatedShipment : s))
        );
    }, [clearCache]);

    return {
        shipments,
        stats,
        loading,
        refreshing,
        error,
        loadData,
        filteredShipments,
        filter, setFilter,
        searchQuery, setSearchQuery,
        carrierFilter, setCarrierFilter,
        dateFilter, setDateFilter,
        isArchivedView, setIsArchivedView,
        selectedIds, setSelectedIds,
        handleSelectAll,
        deleteShipment,
        archiveShipment,
        batchDelete,
        batchArchive,
        importExcel,
        refreshTracking,
        exportExcel,
        updateShipment,
    };
}
