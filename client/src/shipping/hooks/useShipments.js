import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import shipmentApi, { getApiErrorMessage } from '../services/shipmentApi';

const SUCCESS_TIMEOUT_MS = 5000;
const DEFAULT_STATS = { total: 0, transit: 0, delivered: 0, exceptions: 0 };

const buildDateAnchor = (shipment) => shipment?.created_at || shipment?.updated_at || shipment?.booking_date || shipment?.show_date;

export function useShipments(options = {}) {
    const { initialArchivedView = false, autoLoad = true } = options;
    const [shipments, setShipments] = useState([]);
    const [stats, setStats] = useState(DEFAULT_STATS);
    const [loading, setLoading] = useState(autoLoad);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [filter, setFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [carrierFilter, setCarrierFilter] = useState('All');
    const [dateFilter, setDateFilter] = useState('All');
    const [isArchivedView, setIsArchivedView] = useState(initialArchivedView);
    const successTimeoutRef = useRef(null);

    const clearPendingSuccess = useCallback(() => {
        if (successTimeoutRef.current) {
            window.clearTimeout(successTimeoutRef.current);
            successTimeoutRef.current = null;
        }
    }, []);

    const flashSuccess = useCallback((message, timeoutMs = SUCCESS_TIMEOUT_MS) => {
        clearPendingSuccess();
        setSuccess(message);
        successTimeoutRef.current = window.setTimeout(() => {
            setSuccess(null);
            successTimeoutRef.current = null;
        }, timeoutMs);
    }, [clearPendingSuccess]);

    const refreshStats = useCallback(async () => {
        try {
            const statsData = await shipmentApi.fetchStats();
            setStats(statsData);
        } catch (_) {
            // Preserve the current page data if stats refresh fails.
        }
    }, []);

    const loadData = useCallback(async (includeArchived = null, optionsOverride = {}) => {
        const { silent = false } = optionsOverride;
        const archivedState = includeArchived !== null ? includeArchived : isArchivedView;
        if (includeArchived !== null) {
            setIsArchivedView(includeArchived);
        }

        if (!silent) {
            setLoading(true);
        }
        setError(null);

        try {
            const [shipmentsData, statsData] = await Promise.all([
                archivedState ? shipmentApi.fetchArchivedShipments() : shipmentApi.fetchShipments(),
                shipmentApi.fetchStats(),
            ]);
            setShipments(Array.isArray(shipmentsData) ? shipmentsData : []);
            setStats(statsData || DEFAULT_STATS);
            return shipmentsData;
        } catch (requestError) {
            setError(getApiErrorMessage(requestError, 'Failed to load shipments.'));
            return [];
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    }, [isArchivedView]);

    useEffect(() => {
        if (!autoLoad) return undefined;
        void loadData(initialArchivedView);
        return () => {
            clearPendingSuccess();
        };
    }, [autoLoad, clearPendingSuccess, initialArchivedView, loadData]);

    const archiveShipment = useCallback(async (id) => {
        setError(null);
        try {
            await shipmentApi.archiveShipment(id);
            setShipments((previous) => previous.filter((shipment) => shipment.id !== id));
            void refreshStats();
        } catch (requestError) {
            setError(getApiErrorMessage(requestError, 'Failed to update shipment archive status.'));
            await loadData();
        }
    }, [loadData, refreshStats]);

    const deleteShipment = useCallback(async (id) => {
        setError(null);
        try {
            const result = await shipmentApi.deleteShipment(id);
            const deletedIds = Array.isArray(result?.deleted_ids) && result.deleted_ids.length > 0
                ? result.deleted_ids
                : [id];
            setShipments((previous) => previous.filter((shipment) => !deletedIds.includes(shipment.id)));
            void refreshStats();
            return result;
        } catch (requestError) {
            setError(getApiErrorMessage(requestError, 'Failed to delete shipment.'));
            await loadData();
            return null;
        }
    }, [loadData, refreshStats]);

    const batchArchive = useCallback(async (ids, archive) => {
        setError(null);
        try {
            await shipmentApi.batchArchiveShipments(ids, archive);
            setShipments((previous) => previous.filter((shipment) => !ids.includes(shipment.id)));
            void refreshStats();
        } catch (requestError) {
            setError(getApiErrorMessage(requestError, 'Failed to update selected shipments.'));
            await loadData();
        }
    }, [loadData, refreshStats]);

    const batchDelete = useCallback(async (ids) => {
        setError(null);
        try {
            const result = await shipmentApi.batchDeleteShipments(ids);
            const deletedCount = result?.count ?? ids.length;
            await loadData(null, { silent: false });
            flashSuccess(`Successfully deleted ${deletedCount} shipment(s).`);
            return result;
        } catch (requestError) {
            setError(getApiErrorMessage(requestError, 'Failed to delete selected shipments.'));
            await loadData();
            return null;
        }
    }, [flashSuccess, loadData]);

    const importExcel = useCallback(async (file) => {
        setLoading(true);
        setError(null);
        try {
            const result = await shipmentApi.importExcel(file);
            await loadData();
            return result;
        } catch (requestError) {
            setError(getApiErrorMessage(requestError, 'Failed to import shipment sheet.'));
            return null;
        } finally {
            setLoading(false);
        }
    }, [loadData]);

    const refreshTracking = useCallback(async (shipmentIds = null) => {
        setRefreshing(true);
        setError(null);
        try {
            const result = await shipmentApi.refreshShipments(shipmentIds, {
                includeChildren: true,
                timeoutMs: 120000,
            });
            await loadData(null, { silent: true });
            if (result.failed > 0) {
                setError(`Refreshed ${result.refreshed} shipment(s), but ${result.failed} could not be re-synced.`);
            } else if (result.refreshed > 0) {
                flashSuccess(`Successfully refreshed ${result.refreshed} shipment(s).`);
            } else {
                flashSuccess('Tracking is already up to date.', 3000);
            }
            return result;
        } catch (requestError) {
            const message = getApiErrorMessage(requestError, 'Failed to refresh shipment tracking.');
            setError(message);
            return {
                requested: 0,
                refreshed: 0,
                failed: 1,
                errors: [message],
            };
        } finally {
            setRefreshing(false);
        }
    }, [flashSuccess, loadData]);

    const exportExcel = useCallback(async (shipmentIds = null) => {
        setLoading(true);
        setError(null);
        try {
            const ids = Array.isArray(shipmentIds) ? shipmentIds : [];
            const blob = await shipmentApi.exportExcel(ids);
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `shipments_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.URL.revokeObjectURL(url);
            return true;
        } catch (requestError) {
            setError(getApiErrorMessage(requestError, 'Failed to export shipments.'));
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    const filteredShipments = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();

        return shipments.filter((shipment) => {
            const status = String(shipment?.status || '');
            const carrier = String(shipment?.carrier || '');
            const matchesStatus =
                filter === 'All' ||
                status === filter ||
                (filter === 'Active' && status !== 'Delivered') ||
                (filter === 'Exception' && status.toLowerCase().includes('exception'));

            const matchesCarrier = carrierFilter === 'All' || carrier === carrierFilter;

            let matchesDate = true;
            if (dateFilter !== 'All') {
                const anchor = buildDateAnchor(shipment);
                const shipmentDate = anchor ? new Date(anchor) : null;
                if (!shipmentDate || Number.isNaN(shipmentDate.getTime())) {
                    matchesDate = false;
                } else {
                    const today = new Date();
                    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                    if (dateFilter === 'Today') {
                        matchesDate = shipmentDate.toDateString() === startOfToday.toDateString();
                    } else if (dateFilter === 'Last 7 Days') {
                        const sevenDaysAgo = new Date(startOfToday);
                        sevenDaysAgo.setDate(startOfToday.getDate() - 7);
                        matchesDate = shipmentDate >= sevenDaysAgo;
                    }
                }
            }

            if (!normalizedQuery) {
                return matchesStatus && matchesCarrier && matchesDate;
            }

            const searchableBlob = [
                shipment?.tracking_number,
                shipment?.carrier,
                shipment?.recipient,
                shipment?.exhibition_name,
                shipment?.project_name,
                shipment?.project_client_name,
                shipment?.items,
                shipment?.status,
                shipment?.destination,
                shipment?.origin,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return matchesStatus && matchesCarrier && matchesDate && searchableBlob.includes(normalizedQuery);
        });
    }, [carrierFilter, dateFilter, filter, searchQuery, shipments]);

    return {
        shipments,
        stats,
        loading,
        refreshing,
        error,
        success,
        setSuccess,
        loadData,
        filteredShipments,
        filter,
        setFilter,
        searchQuery,
        setSearchQuery,
        carrierFilter,
        setCarrierFilter,
        dateFilter,
        setDateFilter,
        isArchivedView,
        setIsArchivedView,
        deleteShipment,
        archiveShipment,
        batchDelete,
        batchArchive,
        importExcel,
        refreshTracking,
        exportExcel,
    };
}
