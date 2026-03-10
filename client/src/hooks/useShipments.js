import { useState, useCallback, useEffect, useMemo } from 'react';
import {
    fetchShipments,
    fetchArchivedShipments,
    fetchStats,
    deleteShipment as deleteShipmentApi,
    archiveShipment as archiveShipmentApi,
    importExcel as importExcelApi,
    exportExcel as exportExcelApi,
} from '../api';

/**
 * Custom hook encapsulating all shipment data-fetching, filtering, and state.
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

    const loadData = useCallback(async (includeArchived = false) => {
        setLoading(true);
        setError(null);
        try {
            const [shipmentsData, statsData] = await Promise.all([
                includeArchived ? fetchArchivedShipments() : fetchShipments(),
                fetchStats(),
            ]);
            setShipments(shipmentsData);
            setStats(statsData);
        } catch (err) {
            setError(err.message);
            console.error('Failed to load data from backend:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const archiveShipment = useCallback(async (id) => {
        try {
            await archiveShipmentApi(id);
            await loadData();
        } catch (err) {
            setError(err.message);
            console.error('Failed to archive shipment:', err);
        }
    }, [loadData]);

    const deleteShipment = useCallback(async (id) => {
        try {
            await deleteShipmentApi(id);
            await loadData();
        } catch (err) {
            setError(err.message);
            console.error('Failed to delete shipment:', err);
        }
    }, [loadData]);

    const importExcel = useCallback(async (file) => {
        setLoading(true);
        setError(null);
        try {
            await importExcelApi(file);
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
            const blob = await exportExcelApi();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `shipments_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
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
        deleteShipment,
        archiveShipment,
        importExcel,
        exportExcel,
    };
}
