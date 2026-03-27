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
    const [error, setError] = useState(null);

    // Filter state
    const [filter, setFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [carrierFilter, setCarrierFilter] = useState('All');
    const [dateFilter, setDateFilter] = useState('All');
    const [isArchivedView, setIsArchivedView] = useState(false);

    const loadData = useCallback(async (includeArchived = null) => {
        const archivedState = includeArchived !== null ? includeArchived : isArchivedView;
        if (includeArchived !== null) setIsArchivedView(includeArchived);
        
        setLoading(true);
        setError(null);
        try {
            const [shipmentsData, statsData] = await Promise.all([
                archivedState ? shipmentsService.fetchArchivedShipments() : shipmentsService.fetchShipments(),
                shipmentsService.fetchStats(),
            ]);
            setShipments(shipmentsData);
            setStats(statsData);
        } catch (err) {
            setError(err.message);
            console.error('Failed to load data from backend:', err);
        } finally {
            setLoading(false);
        }
    }, [isArchivedView]);

    useEffect(() => { loadData(false); }, [loadData]); // Initial load default to dashboard

    const archiveShipment = useCallback(async (id) => {
        // Optimistic Update
        setShipments(prev => prev.filter(s => s.id !== id));
        try {
            await shipmentsService.archiveShipment(id);
            // Refresh stats in background
            shipmentsService.fetchStats().then(setStats).catch(console.error);
        } catch (err) {
            setError(err.message);
            console.error('Failed to archive shipment:', err);
            loadData(); // Rollback on error
        }
    }, [loadData]);

    const deleteShipment = useCallback(async (id) => {
        // Optimistic Update
        setShipments(prev => prev.filter(s => s.id !== id));
        try {
            await shipmentsService.deleteShipment(id);
            shipmentsService.fetchStats().then(setStats).catch(console.error);
        } catch (err) {
            setError(err.message);
            console.error('Failed to delete shipment:', err);
            loadData(); // Rollback
        }
    }, [loadData]);

    const batchArchive = useCallback(async (ids, archive) => {
        // Optimistic Update
        setShipments(prev => prev.filter(s => !ids.includes(s.id)));
        try {
            await shipmentsService.batchArchiveShipments(ids, archive);
            shipmentsService.fetchStats().then(setStats).catch(console.error);
        } catch (err) {
            setError(err.message);
            loadData();
        }
    }, [loadData]);

    const batchDelete = useCallback(async (ids) => {
        // Optimistic Update
        setShipments(prev => prev.filter(s => !ids.includes(s.id)));
        try {
            await shipmentsService.batchDeleteShipments(ids);
            shipmentsService.fetchStats().then(setStats).catch(console.error);
        } catch (err) {
            setError(err.message);
            loadData();
        }
    }, [loadData]);

    const importExcel = useCallback(async (file) => {
        setLoading(true);
        setError(null);
        try {
            await shipmentsService.importExcel(file);
            await loadData();
        } catch (err) {
            setError(err.message);
            console.error('Failed to import Excel file:', err);
        } finally {
            setLoading(false);
        }
    }, [loadData]);

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
                (item.items || '').toLowerCase().includes(q) ||
                (item.status || '').toLowerCase().includes(q);

            return matchesStatus && matchesCarrier && matchesDate && matchesSearch;
        });
    }, [filter, carrierFilter, dateFilter, searchQuery, shipments]);

    const exportExcel = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const blob = await shipmentsService.exportExcel();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `shipments_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        shipments,
        stats,
        loading,
        error,
        loadData,
        filteredShipments,
        filter, setFilter,
        searchQuery, setSearchQuery,
        carrierFilter, setCarrierFilter,
        dateFilter, setDateFilter,
        isArchivedView, setIsArchivedView,
        deleteShipment,
        archiveShipment,
        batchDelete,
        batchArchive,
        importExcel,
        exportExcel,
    };
}
