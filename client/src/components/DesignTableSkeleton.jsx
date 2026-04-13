import React from 'react';

const COLS = 8;
const ROWS = 10;

export default function DesignTableSkeleton() {
    return (
        <table className="design-table design-table--skeleton" aria-hidden>
            <thead>
                <tr>
                    <th className="design-table__th design-table__th--left">Brief ID</th>
                    <th className="design-table__th design-table__th--center">Status</th>
                    <th className="design-table__th design-table__th--left">Project Name</th>
                    <th className="design-table__th design-table__th--left design-table__th--client">Client</th>
                    <th className="design-table__th design-table__th--left design-table__th--city">City</th>
                    <th className="design-table__th design-table__th--right">Version</th>
                    <th className="design-table__th design-table__th--right">Booking Date</th>
                    <th className="design-table__th design-table__th--right">Show Date</th>
                </tr>
            </thead>
            <tbody>
                {Array.from({ length: ROWS }, (_, row) => (
                    <tr key={row} className="design-table__skeleton-row">
                        {Array.from({ length: COLS }, (_, col) => (
                            <td key={col} className="design-table__td">
                                <div
                                    className="design-table__skeleton-cell"
                                    style={{ width: col === 2 ? '72%' : col === 0 ? '56%' : col === 6 || col === 7 ? '80%' : '64%' }}
                                />
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
