import os
import re

fp = r'd:\Desktop\Insta-Track\client\src\views\ProjectsDashboard.jsx'
with open(fp, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove old search
# Make sure to remove the whole tracking-toolbar div
toolbar_pattern = r' *\{\/\* Search & Actions \*\/\}\n *<div className="tracking-toolbar".*?</div>\n *</div>\n'
content = re.sub(toolbar_pattern, '', content, flags=re.DOTALL)

# 2. Replace header
header_start = '<header className="main-header">'
header_end = '<div className="header-accent-bar" />'

new_header = """<header className="design-premium-header" style={{ top: '16px', marginBottom: '32px' }}>
                        <div className="design-premium-header__inner">
                            <div className="design-premium-header__brand">
                                <img src="/logo.jpg" alt="Insta-SCM Logo" className="design-premium-header__logo" />
                            </div>

                            <div className="design-premium-header__search-container">
                                <label className="design-premium-search">
                                    <Search size={16} className="design-premium-search__icon" aria-hidden />
                                    <input
                                        type="search"
                                        placeholder="Search Project ID, Event, Manager..."
                                        value={searchQuery}
                                        onChange={(event) => setSearchQuery(event.target.value)}
                                    />
                                    <div className="design-premium-search__shortcut">CMD K</div>
                                </label>
                            </div>

                            <div className="design-premium-header__filters">
                                <div className="design-premium-filter">
                                    <div className="design-premium-filter__label">Board Stage</div>
                                    <label className="design-premium-filter__control">
                                        <Layout size={14} className="design-premium-filter__icon" />
                                        <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
                                            {uniqueBoardStages.map(stageName => (
                                                <option key={stageName} value={stageName}>{stageName === 'All' ? 'All Stages' : stageName}</option>
                                            ))}
                                        </select>
                                    </label>
                                </div>

                                <div className="design-premium-filter">
                                    <div className="design-premium-filter__label">Branch</div>
                                    <label className="design-premium-filter__control">
                                        <MapPin size={14} className="design-premium-filter__icon" />
                                        <select value={filterBranch} onChange={(event) => setFilterBranch(event.target.value)}>
                                            {uniqueBranches.map(b => (
                                                <option key={b} value={b}>{b === 'All' ? 'All Branches' : b}</option>
                                            ))}
                                        </select>
                                    </label>
                                </div>

                                <div className="design-premium-filter">
                                    <div className="design-premium-filter__label">Manager</div>
                                    <label className="design-premium-filter__control">
                                        <Users size={14} className="design-premium-filter__icon" />
                                        <select value={filterPM} onChange={(event) => setFilterPM(event.target.value)}>
                                            {uniquePMs.map(pm => (
                                                <option key={pm} value={pm}>{pm === 'All' ? 'All Managers' : pm}</option>
                                            ))}
                                        </select>
                                    </label>
                                </div>

                                <div className="design-premium-filter">
                                    <div className="design-premium-filter__label">Date range</div>
                                    <PremiumDateRangePicker />
                                </div>
                            </div>

                            <div className="design-premium-header__actions">
                                {(filterStage !== 'All' || filterStatus !== 'All' || filterBranch !== 'All' || filterPM !== 'All' || searchQuery !== '' || isProjectSelected || activeProjectCard) && (
                                    <button
                                        type="button"
                                        className="design-premium-btn"
                                        style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
                                        onClick={resetFilters}
                                        title="Clear all filters"
                                    >
                                        <X size={14} /> Clear
                                    </button>
                                )}

                                <button
                                    type="button"
                                    className="design-premium-btn design-premium-btn--primary"
                                    onClick={loadData}
                                    disabled={loading}
                                >
                                    <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                                    {loading ? 'Syncing...' : 'Refresh'}
                                </button>
                                
                                <button
                                    type="button"
                                    className="design-premium-icon-btn"
                                    onClick={toggleThemeLocal}
                                    title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                                >
                                    {isDark ? <Sun size={18} /> : <Moon size={18} />}
                                </button>
                            </div>
                        </div>
                    </header>"""

pattern = r'<header className="main-header">.*?</header>\s*<div className="header-accent-bar" />'
content = re.sub(pattern, new_header, content, flags=re.DOTALL)

with open(fp, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
