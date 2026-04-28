import { useCallback, useState } from 'react';

export function useShipmentSelection(initialValue = []) {
    const [selectedIds, setSelectedIds] = useState(initialValue);

    const clearSelection = useCallback(() => {
        setSelectedIds([]);
    }, []);

    const pruneSelection = useCallback((validIds) => {
        setSelectedIds((previous) => previous.filter((id) => validIds.includes(id)));
    }, []);

    return {
        selectedIds,
        setSelectedIds,
        clearSelection,
        pruneSelection,
    };
}
