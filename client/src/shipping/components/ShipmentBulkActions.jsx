import React from 'react';
import { Archive, Trash2 } from 'lucide-react';

const ShipmentBulkActions = ({
    count,
    archiveLabel,
    deleteLabel,
    onArchive,
    onDelete,
    onCancel,
}) => {
    if (!count) return null;

    return (
        <div className="batch-toolbar shipping-batch-toolbar animate-in-up">
            <div className="bt-info">
                <div className="bt-count">{count}</div>
                <span>shipments selected</span>
            </div>
            <div className="bt-actions">
                <button className="bt-btn archive" onClick={onArchive}>
                    <Archive size={14} /> {archiveLabel}
                </button>
                <button className="bt-btn delete" onClick={onDelete}>
                    <Trash2 size={14} /> {deleteLabel}
                </button>
                <button className="bt-close" onClick={onCancel}>Cancel</button>
            </div>
        </div>
    );
};

export default ShipmentBulkActions;
