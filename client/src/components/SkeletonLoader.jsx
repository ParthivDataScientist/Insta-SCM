import React from 'react';

/**
 * Skeleton Loader for Kanban Cards
 */
export const CardSkeleton = () => (
    <div className="animate-pulse" style={{
        background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--r-md)',
        marginBottom: '12px', border: '1px solid var(--bd-l)', height: '120px'
    }}>
        <div style={{ height: '12px', width: '40%', background: 'var(--bg-chip)', borderRadius: '4px', marginBottom: '12px' }} />
        <div style={{ height: '16px', width: '90%', background: 'var(--bg-chip)', borderRadius: '4px', marginBottom: '8px' }} />
        <div style={{ height: '16px', width: '70%', background: 'var(--bg-chip)', borderRadius: '4px', marginBottom: '16px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ height: '24px', width: '24px', borderRadius: '50%', background: 'var(--bg-chip)' }} />
            <div style={{ height: '24px', width: '60px', borderRadius: '4px', background: 'var(--bg-chip)' }} />
        </div>
    </div>
);

/**
 * Full Board Skeleton
 */
export const BoardSkeleton = ({ stages }) => (
    <div style={{ display: 'flex', gap: '20px', paddingBottom: '24px' }}>
        {stages.map(stage => (
            <div key={stage} style={{ width: '300px', flexShrink: 0 }}>
                <div style={{ height: '45px', background: 'var(--bg-card)', borderRadius: 'var(--r-md) var(--r-md) 0 0', border: '1px solid var(--bd)', marginBottom: '10px' }} />
                <div style={{ padding: '0 10px' }}>
                    <CardSkeleton />
                    <CardSkeleton />
                    <CardSkeleton />
                </div>
            </div>
        ))}
    </div>
);
