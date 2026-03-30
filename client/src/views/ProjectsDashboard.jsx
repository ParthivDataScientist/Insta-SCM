import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, RefreshCw, Briefcase, MapPin, AlertTriangle, ChevronRight, Truck, LogOut, Search, X, CheckCircle, Users, Layout, Archive } from 'lucide-react';

// Hooks
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '../contexts/AuthContext';

// Components
import ProjectTable from '../components/ProjectTable';
import { CardSkeleton } from '../components/SkeletonLoader';
import { Link } from 'react-router-dom';
import AddProjectModal from '../components/AddProjectModal';

export default function ProjectsDashboard() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState(null); // 'open', 'branch', 'pm'
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [selectedProject, setSelectedProject] = useState(null);

    const {
        projects, filteredProjects, stats, loading, error, loadData,
        filterStage, setFilterStage,
        filterBranch, setFilterBranch,
        filterPM, setFilterPM,
        searchQuery, setSearchQuery,
        updateProjectFull,
        createProject
    } = useProjects();

    const handleDoubleClick = (project) => {
        if (project.stage?.toLowerCase() === 'confirmed') {
            navigate(`/board?projectId=${project.id}`);
        }
    };

    // Memoize derivative data for performance
    const uniqueOpenStages = useMemo(() => 
        ['All Open', ...new Set(projects.filter(p => p.stage?.toLowerCase() !== 'confirmed').map(p => p.stage).filter(Boolean))].sort(),
    [projects]);

    const uniqueBranches = useMemo(() => 
        ['All', ...new Set(projects.map(p => p.branch).filter(Boolean))].sort(),
    [projects]);

    const uniquePMs = useMemo(() => 
        ['All', ...new Set(projects.map(p => p.project_manager).filter(Boolean))].sort(),
    [projects]);

    const isDark = localStorage.getItem('insta_theme') === 'dark';
    const isProjectSelected = !!selectedProject;

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
        setFilterBranch('All');
        setFilterPM('All');
        setSearchQuery('');
        setSelectedProject(null);
        setActiveDropdown(null);
    };

    return (
        <div className={isDark ? 'dark' : 'light'} style={{ minHeight: '100vh', background: 'var(--bg)' }}>
            <div className={`app-layout ${sidebarOpen ? '' : 'sidebar-closed'}`}>
                {/* ═══════ SIDEBAR ═══════ */}
                <aside className="sidebar">
                    <div className="sidebar-logo">
                        <img src="/logo.jpg" alt="Insta-SCM Logo" style={{ width: '130px', height: 'auto' }} />
                    </div>
                    <div className="sidebar-tagline">Excellence in Exhibition Logistics</div>

                    <nav className="sidebar-nav">
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
                    <header className="main-header">
                        <div className="header-welcome" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <button className="icon-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
                                <Menu size={20} />
                            </button>
                            <div>
                                <h1>Welcome, <strong>{user?.full_name || 'Operations Manager'}</strong></h1>
                                <p className="header-role">Insta Exhibition - Projects Dashboard</p>
                            </div>
                        </div>
                        <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <button className="icon-btn btn-animate" onClick={() => setIsAddModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'var(--blu)', color: 'white', border: 'none', borderRadius: 'var(--r-md)', fontSize: 13, fontWeight: 700, height: '36px', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)' }}>
                                <Briefcase size={14} /> + NEW PROJECT
                            </button>
                            {(filterStage !== 'All' || filterBranch !== 'All' || filterPM !== 'All' || searchQuery !== '' || isProjectSelected) && (
                                <button className="icon-btn btn-animate" onClick={resetFilters} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 13, fontWeight: 600, color: 'var(--tx2)' }}>
                                    <X size={14} /> Disable Filters
                                </button>
                            )}
                            <button className="icon-btn btn-animate" onClick={loadData} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 13, fontWeight: 600 }}>
                                <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                                {loading ? 'Syncing...' : 'Refresh'}
                            </button>
                            <button className="icon-btn btn-animate" onClick={logout} style={{ marginLeft: '0.5rem', color: '#E53935' }}>
                                <LogOut size={16} />
                            </button>
                        </div>
                    </header>
                {/* Secure & Lazy Modal */}
                {isAddModalOpen && (
                    <AddProjectModal 
                        onClose={() => setIsAddModalOpen(false)} 
                        createProject={createProject} 
                        refetch={loadData}
                    />
                )}

                <div className="header-accent-bar" />

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

                            <div className={`kpi-card ${filterStage !== 'All' && filterStage !== 'Confirmed' ? 'active-kpi' : ''}`} 
                                 onClick={() => !isProjectSelected && setActiveDropdown('open')}>
                                <div className="kpi-left">
                                    <div className="kpi-title">Open Briefs</div>
                                    <div className="kpi-value" style={{ fontSize: displayOpen?.length > 8 ? '18px' : '36px' }}>{displayOpen}</div>
                                    <div className="kpi-sub orange">Pending confirmation</div>
                                </div>
                                <div className="kpi-icon orange-icon"><RefreshCw size={22} /></div>
                                {activeDropdown === 'open' && (
                                    <div className="kpi-dropdown show">
                                        {uniqueOpenStages.map(os => (
                                            <div key={os} className="kpi-dropdown-item" onClick={(e) => { e.stopPropagation(); setFilterStage(os === 'All Open' ? 'Open' : os); setActiveDropdown(null); }}>
                                                {os}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className={`kpi-card ${filterStage === 'Confirmed' ? 'active-kpi' : ''}`} onClick={() => !isProjectSelected && handleKPIClick('Confirmed')}>
                                <div className="kpi-left">
                                    <div className="kpi-title">Won Projects</div>
                                    <div className="kpi-value">{displayWon}</div>
                                    <div className="kpi-sub green">Confirmed stages</div>
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

                        {/* Search & Actions */}
                        <div className="tracking-toolbar" style={{ margin: '24px 0' }}>
                            <div className="toolbar-search">
                                <Search size={14} className="ts-icon" />
                                <input className="ts-input" placeholder="Search Project, Event, Manager..."
                                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
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
