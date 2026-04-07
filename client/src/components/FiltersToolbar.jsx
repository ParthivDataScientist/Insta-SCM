import React, { useMemo } from 'react';
import { Filter, MapPin, Search, User, X, ChevronDown } from 'lucide-react';

const defaultAllLabel = (label) => {
    if (label === 'Branch') return 'All Branches';
    if (label === 'Project Manager') return 'All Managers';
    return `All ${label}s`;
};

const FilterDropdown = ({ label, value, options, onChange, icon: Icon }) => (
    <div style={{ position: 'relative', flex: '1', minWidth: '150px' }}>
        <div style={{ 
            display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', 
            background: 'var(--bg-in)', border: '1px solid var(--bd)', borderRadius: 'var(--r-md)',
            transition: 'all 0.2s ease', position: 'relative'
        }}>
            {Icon && <Icon size={14} color="var(--tx3)" />}
            <div style={{ flex: 1, position: 'relative' }}>
                <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '1px' }}>{label}</div>
                <select 
                    value={value} 
                    onChange={(e) => onChange(e.target.value)}
                    style={{ 
                        width: '100%', background: 'transparent', border: 'none', outline: 'none',
                        fontSize: '12px', fontWeight: 600, color: 'var(--tx)', cursor: 'pointer',
                        padding: '0 20px 0 0', margin: 0, appearance: 'none', WebkitAppearance: 'none'
                    }}
                >
                    <option value="All">{defaultAllLabel(label)}</option>
                    {options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
                <ChevronDown size={12} color="var(--tx3)" style={{ position: 'absolute', right: 0, bottom: '2px', pointerEvents: 'none' }} />
            </div>
        </div>
    </div>
);

export default function FiltersToolbar({ 
    projects, 
    filterPM, setFilterPM,
    filterBranch = 'All', setFilterBranch,
    filterStatus, setFilterStatus,
    searchQuery, setSearchQuery,
    boardStages,
    showSearch = true,
    statusLabel = 'Stage',
}) {
    const uniquePMs = useMemo(() => [...new Set(projects.map(p => p.project_manager).filter(Boolean))].sort(), [projects]);
    const uniqueBranches = useMemo(() => [...new Set(projects.map((project) => project.branch).filter(Boolean))].sort(), [projects]);

    const activeFilters = useMemo(() => {
        const tags = [];
        if (filterPM !== 'All') tags.push({ id: 'pm', label: `PM: ${filterPM}`, clear: () => setFilterPM('All') });
        if (filterBranch !== 'All') tags.push({ id: 'branch', label: `Branch: ${filterBranch}`, clear: () => setFilterBranch?.('All') });
        if (filterStatus !== 'All') tags.push({ id: 'status', label: `${statusLabel}: ${filterStatus}`, clear: () => setFilterStatus('All') });
        return tags;
    }, [filterBranch, filterPM, filterStatus, setFilterBranch, setFilterPM, setFilterStatus, statusLabel]);

    const clearAll = () => {
        setFilterPM('All');
        setFilterBranch?.('All');
        setFilterStatus('All');
        setSearchQuery?.('');
    };

    return (
        <div className="animate-card" style={{ 
            width: '100%', display: 'flex', flexDirection: 'column', gap: '12px', 
            background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--r-lg)', 
            border: '1px solid var(--bd)', boxShadow: 'var(--sh)', marginBottom: '16px'
        }}>
            {/* Main Filters Row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
                {/* Search Bar */}
                {showSearch && setSearchQuery ? (
                    <div style={{ position: 'relative', flex: '2', minWidth: '240px' }}>
                        <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--tx3)' }} size={14} />
                        <input 
                            type="text"
                            placeholder="Search project, event, branch, or manager..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ 
                                width: '100%', padding: '8px 12px 8px 34px', background: 'var(--bg-in)', 
                                border: '1px solid var(--bd)', borderRadius: 'var(--r-md)', fontSize: '13px', 
                                color: 'var(--tx)', outline: 'none'
                            }}
                        />
                    </div>
                ) : null}

                <FilterDropdown label="Project Manager" value={filterPM} options={uniquePMs} onChange={setFilterPM} icon={User} />
                {setFilterBranch ? (
                    <FilterDropdown label="Branch" value={filterBranch} options={uniqueBranches} onChange={setFilterBranch} icon={MapPin} />
                ) : null}
                <FilterDropdown label={statusLabel} value={filterStatus} options={boardStages} onChange={setFilterStatus} icon={Filter} />

                {(activeFilters.length > 0 || Boolean(searchQuery)) && (
                    <button 
                        onClick={clearAll}
                        className="btn-animate"
                        style={{ fontSize: '11px', fontWeight: 700, color: 'var(--red-v)', padding: '6px 10px', cursor: 'pointer' }}
                    >
                        Reset
                    </button>
                )}
            </div>

            {/* Tags Row (only if needed) */}
            {activeFilters.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', borderTop: '1px solid var(--bd-l)', paddingTop: '10px' }}>
                    {activeFilters.map(tag => (
                        <div key={tag.id} className="animate-card" style={{ 
                            display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 10px', 
                            background: 'var(--org-light)', color: 'var(--org)', border: '1px solid var(--o-bd)', 
                            borderRadius: 'var(--r-pill)', fontSize: '10px', fontWeight: 800
                        }}>
                            {tag.label}
                            <button onClick={tag.clear} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                <X size={10} strokeWidth={3} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
