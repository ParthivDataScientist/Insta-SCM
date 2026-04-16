import React, { Suspense, lazy, useMemo, useState } from 'react';
import { Menu, RefreshCw, Briefcase, MapPin, Truck, LogOut, Search, X, CheckCircle, Users, Layout, Archive, PenTool, Sun, Moon, SlidersHorizontal, Bell } from 'lucide-react';

// Hooks
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '../contexts/AuthContext';

// Components
import ProjectTable from '../components/ProjectTable';
import { CardSkeleton } from '../components/SkeletonLoader';
import GlobalDateRangePicker from '../components/GlobalDateRangePicker';
import PremiumDateRangePicker from '../components/PremiumDateRangePicker';
import { Link } from 'react-router-dom';
import '../design-premium.css';

const ProjectBoardModal = lazy(() => import('../components/ProjectBoardModal'));

export default function ProjectsDashboard() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState(null); // 'stage', 'branch', 'pm'
    const { user, logout } = useAuth();
    const [selectedProject, setSelectedProject] = useState(null);
    const [activeProjectCard, setActiveProjectCard] = useState(null);

    const {
        projects, filteredProjects, stats, loading, error, loadData,
        filterStage, setFilterStage,
        filterBranch, setFilterBranch,
        filterPM, setFilterPM,
        filterStatus, setFilterStatus,
        searchQuery, setSearchQuery,
        updateProjectFull
    } = useProjects();

    const handleDoubleClick = (project) => {
        setActiveProjectCard(project);
    };

    // Memoize derivative data for performance
    const uniqueBoardStages = useMemo(() => 
        ['All', ...new Set(projects.map(p => p.board_stage || 'TBC').filter(Boolean))].sort(),
    [projects]);

    const uniqueBranches = useMemo(() => 
        ['All', ...new Set(projects.map(p => p.branch).filter(Boolean))].sort(),
    [projects]);

    const uniquePMs = useMemo(() => 
        ['All', ...new Set(projects.map(p => p.project_manager).filter(Boolean))].sort(),
    [projects]);

    const { theme, toggleTheme } = useTheme?.() || { theme: 'light', toggleTheme: () => {} };
    // fallback if useTheme isn't mapped
    const isDarkGlobal = localStorage.getItem('insta_theme') === 'dark';
    const [isDarkLocal, setIsDarkLocal] = useState(isDarkGlobal);
    const isDark = isDarkLocal;
    const toggleThemeLocal = () => {
        const newMode = !isDarkLocal;
        setIsDarkLocal(newMode);
        localStorage.setItem('insta_theme', newMode ? 'dark' : 'light');
        document.documentElement.classList.toggle('dark', newMode);
    };
    const isProjectSelected = !!selectedProject;
    const latestActiveProject = projects.find((project) => project.id === activeProjectCard?.id) || activeProjectCard;
    const displayBoardStage = isProjectSelected
        ? (selectedProject.board_stage || 'TBC')
        : (filterStatus === 'All' ? Math.max(0, uniqueBoardStages.length - 1) : filterStatus);
    const displayExecution = isProjectSelected
        ? (selectedProject.stage || 'Win')
        : (stats.won_projects ?? projects.length ?? 0);

    // KPI Display Logic
    const displayBranch = isProjectSelected ? (selectedProject.branch || 'None') : (filterBranch === 'All' ? (stats.branches_count ?? 0) : filterBranch);
    const displayPM = isProjectSelected ? (selectedProject.project_manager || 'None') : (filterPM === 'All' ? (stats.pm_count ?? 0) : filterPM);
    const displayOpen = isProjectSelected ? ((!selectedProject.stage || selectedProject.stage.toLowerCase() !== 'confirmed') ? (selectedProject.stage || 'Open') : '—') : (stats.open_briefs ?? 0);
    const displayWon = isProjectSelected ? ((selectedProject.stage && selectedProject.stage.toLowerCase() === 'confirmed') ? (selectedProject.stage || 'Confirmed') : '—') : (stats.won_projects ?? 0);
    
    const handleKPIClick = (stage) => {
        setFilterStage(prev => prev === stage ? 'All' : stage);
        setActiveDropdown(null);
    };

    const resetFilters = () => {
        setFilterStage('All');
        setFilterStatus('All');
        setFilterBranch('All');
        setFilterPM('All');
        setSearchQuery('');
        setSelectedProject(null);
        setActiveProjectCard(null);
        setActiveDropdown(null);
    };

    return (
        <div className={isDark ? 'dark' : 'light'} style={{ minHeight: '100vh', background: 'var(--bg)' }}>
            <div className={`app-layout ${sidebarOpen ? '' : 'sidebar-closed'}`}>
                <Suspense fallback={null}>
                    {latestActiveProject && (
                        <ProjectBoardModal
                            project={latestActiveProject}
                            onClose={() => setActiveProjectCard(null)}
                            updateProjectFull={updateProjectFull}
                        />
                    )}
                </Suspense>
                {/* ═══════ SIDEBAR ═══════ */}
                <aside className="sidebar">
                    <div className="sidebar-logo">
                        <img src="/logo.jpg" alt="Insta-SCM Logo" style={{ width: '130px', height: 'auto' }} />
                    </div>
                    <div className="sidebar-tagline">Excellence in Exhibition Logistics</div>

                    <nav className="sidebar-nav">
                        <Link to="/design" className="sidebar-item">
                            <PenTool size={17} /> Design Management
                        </Link>
                        <Link to="/projects" className="sidebar-item active">
                            <Briefcase size={17} /> Projects List
                        </Link>
                        <Link to="/board" className="sidebar-item">
                            <Layout size={17} /> Project Board
                        </Link>
                        <Link to="/timeline" className="sidebar-item">
                            <RefreshCw size={17} /> Resource Timeline
                        </Link>
                        <Link to="/dashboard" className="sidebar-item">
                            <Truck size={17} /> Shipment Tracking
                        </Link>
                        <Link to="/storage" className="sidebar-item">
                            <Archive size={17} /> Storage
                        </Link>
                    </nav>
                </aside>

                {/* ═══════ MAIN ═══════ */}
                <main className="main-content">
                    <header className="design-premium-header" style={{ top: '16px', marginBottom: '32px' }}>
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
                                    <div className="design-premium-search__shortcut">⌘ K</div>
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
                    </header>

                    <div className="tracking-body">
                        {/* ── KPI Cards ── */}
                        <div className="kpi-row kpi-row-5">
                            <div className={`kpi-card ${filterStage === 'All' ? 'active-kpi' : ''}`} onClick={() => !isProjectSelected && handleKPIClick('All')}>
                                <div className="kpi-left">
                                    <div className="kpi-title">Total Projects</div>
                                    <div className="kpi-value">{isProjectSelected ? '1' : (stats.total ?? 0)}</div>
                                    <div className="kpi-sub muted">Registered projects</div>
                                </div>
                                <div className="kpi-icon blue-icon"><Briefcase size={22} /></div>
                            </div>

                            <div className={`kpi-card ${filterStatus !== 'All' ? 'active-kpi' : ''}`} 
                                 onClick={() => !isProjectSelected && setActiveDropdown('stage')}>
                                <div className="kpi-left">
                                    <div className="kpi-title">Board Stages</div>
                                    <div className="kpi-value" style={{ fontSize: String(displayBoardStage)?.length > 8 ? '18px' : '36px' }}>{displayBoardStage}</div>
                                    <div className="kpi-sub orange">Kanban workflow stages</div>
                                </div>
                                <div className="kpi-icon orange-icon"><Layout size={22} /></div>
                                {activeDropdown === 'stage' && (
                                    <div className="kpi-dropdown show">
                                        {uniqueBoardStages.map(stageName => (
                                            <div key={stageName} className="kpi-dropdown-item" onClick={(e) => { e.stopPropagation(); setFilterStatus(stageName); setActiveDropdown(null); }}>
                                                {stageName === 'All' ? 'All Stages' : stageName}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className={`kpi-card ${filterStage === 'Confirmed' ? 'active-kpi' : ''}`} onClick={() => !isProjectSelected && handleKPIClick('Confirmed')}>
                                <div className="kpi-left">
                                    <div className="kpi-title">Execution Projects</div>
                                    <div className="kpi-value">{displayExecution}</div>
                                    <div className="kpi-sub green">Promoted from Design</div>
                                </div>
                                <div className="kpi-icon green-icon"><CheckCircle size={22} /></div>
                            </div>

                            <div className={`kpi-card ${filterBranch !== 'All' ? 'active-kpi' : ''}`} onClick={() => !isProjectSelected && setActiveDropdown('branch')}>
                                <div className="kpi-left">
                                    <div className="kpi-title">Branches</div>
                                    <div className="kpi-value">{displayBranch}</div>
                                    <div className="kpi-sub muted">Global locations</div>
                                </div>
                                <div className="kpi-icon purple-icon"><MapPin size={22} /></div>
                                {activeDropdown === 'branch' && (
                                    <div className="kpi-dropdown show">
                                        {uniqueBranches.map(b => (
                                            <div key={b} className="kpi-dropdown-item" onClick={(e) => { e.stopPropagation(); setFilterBranch(b); setActiveDropdown(null); }}>
                                                {b === 'All' ? 'All Branches' : b}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className={`kpi-card ${filterPM !== 'All' ? 'active-kpi' : ''}`} onClick={() => !isProjectSelected && setActiveDropdown('pm')}>
                                <div className="kpi-left">
                                    <div className="kpi-title">Managers</div>
                                    <div className="kpi-value">{displayPM}</div>
                                    <div className="kpi-sub muted">Active assignees</div>
                                </div>
                                <div className="kpi-icon gray-icon"><Users size={22} /></div>
                                {activeDropdown === 'pm' && (
                                    <div className="kpi-dropdown show">
                                        {uniquePMs.map(pm => (
                                            <div key={pm} className="kpi-dropdown-item" onClick={(e) => { e.stopPropagation(); setFilterPM(pm); setActiveDropdown(null); }}>
                                                {pm === 'All' ? 'All Managers' : pm}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>


                        {/* Data Table */}
                        <div className="bottom-row">
                            <div className="tracking-table-wrap" style={{ minHeight: '400px' }}>
                                {loading && projects.length === 0 ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', padding: '20px' }}>
                                        <CardSkeleton /><CardSkeleton /><CardSkeleton />
                                    </div>
                                ) : (
                                    <ProjectTable 
                                        projects={filteredProjects} 
                                        loading={loading} 
                                        selectedProject={selectedProject} 
                                        onSelectProject={setSelectedProject}
                                        updateProjectFull={updateProjectFull}
                                        onDoubleClickProject={handleDoubleClick}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
