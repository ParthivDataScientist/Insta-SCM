import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, RefreshCw, AlertTriangle, ChevronRight, Briefcase, Truck, Archive, LogOut, Layout, Calendar, PenTool } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DndContext, PointerSensor, useSensor, useSensors, closestCorners } from '@dnd-kit/core';

// Hooks & Context
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '../contexts/AuthContext';

// Components
import KanbanColumn from '../components/KanbanColumn';
import FiltersToolbar from '../components/FiltersToolbar';
import { BoardSkeleton } from '../components/SkeletonLoader';
import { isWonProject } from '../utils/projectStatus';

// Lazy load modal for performance
const ProjectBoardModal = lazy(() => import('../components/ProjectBoardModal'));

const Logo = () => (
    <img src="/logo.jpg" alt="Insta-SCM Logo" style={{ width: '130px', height: 'auto' }} />
);

const BOARD_STAGES = [
    "TBC", "Approved", "Material management", "upcoming Prebuild",
    "Current Prebuild", "QC Ready", "Ready to ship", "Shipped",
    "Assembeled", "Return to Inventory"
];

/**
 * ProjectBoard View
 * Production-grade Kanban implementation with React Query, Framer Motion and dnd-kit.
 */
export default function ProjectBoard() {
    const [isDark, setIsDark] = useState(() => localStorage.getItem('insta_theme') === 'dark');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState(null);
    const { user, logout } = useAuth();
    const location = useLocation();

    const {
        projects, filteredProjects, loading, error, loadData, updateBoardStage, updateProjectFull,
        filterPM, setFilterPM,
        filterCity, setFilterCity,
        filterClient, setFilterClient,
        filterStatus, setFilterStatus,
        dateRange, setDateRange,
        searchQuery, setSearchQuery
    } = useProjects();

    // Memoize confirmed projects to prevent unnecessary filter recalculations
    const confirmedProjects = useMemo(() => 
        filteredProjects.filter(p => isWonProject(p.stage)),
    [filteredProjects]);

    const toggleTheme = useCallback(() => {
        setIsDark(prev => {
            const next = !prev;
            localStorage.setItem('insta_theme', next ? 'dark' : 'light');
            return next;
        });
    }, []);

    // Deep-linking from Projects List
    const hasLinked = React.useRef(false);
    useEffect(() => {
        if (hasLinked.current) return; 
        const params = new URLSearchParams(location.search);
        const projectId = params.get('projectId');
        if (projectId && confirmedProjects.length > 0) {
            const proj = confirmedProjects.find(p => p.id === parseInt(projectId));
            if (proj) {
                hasLinked.current = true; 
                setSelectedProject(proj);
                const timer = setTimeout(() => {
                    const card = document.getElementById(`board-card-${projectId}`);
                    card?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                }, 500);
                return () => clearTimeout(timer);
            }
        }
    }, [location.search, confirmedProjects]);

    // Dnd-kit Configuration
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5, // Requires 5px movement before drag starts (prevent accidental clicks)
            },
        })
    );

    const handleDragEnd = useCallback((event) => {
        const { active, over } = event;
        if (!over) return;

        const projectId = active.data.current?.id;
        const targetStage = over.id;

        if (projectId && targetStage && active.data.current?.stage !== targetStage) {
            updateBoardStage(projectId, targetStage);
        }
    }, [updateBoardStage]);

    return (
        <div className={isDark ? 'dark' : 'light'} style={{ minHeight: '100vh', background: 'var(--bg)', transition: 'background 0.3s ease' }}>
            <div className={`app-layout ${sidebarOpen ? '' : 'sidebar-closed'}`}>

                {/* Secure & Lazy Modal */}
                <AnimatePresence>
                    {selectedProject && (
                        <Suspense fallback={<div style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999}}/>}>
                            <ProjectBoardModal 
                                project={projects.find((p) => p.id === selectedProject.id) || selectedProject} 
                                onClose={() => setSelectedProject(null)} 
                                updateProjectFull={updateProjectFull}
                            />
                        </Suspense>
                    )}
                </AnimatePresence>

                {/* ═══════ SIDEBAR ═══════ */}
                <aside className="sidebar">
                    <div className="sidebar-logo"><Logo /></div>
                    <div className="sidebar-tagline">Excellence in Exhibition Logistics</div>

                    <nav className="sidebar-nav">
                        <Link to="/design" className="sidebar-item">
                            <PenTool size={17} /> Design Management
                        </Link>
                        <Link to="/projects" className="sidebar-item">
                            <Briefcase size={17} /> Projects List
                        </Link>
                        <Link to="/board" className="sidebar-item active">
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
                    
                    <div className="sidebar-footer-area">
                        <a href="mailto:kalyan.karande@insta-group.com" className="sidebar-footer-support">
                            <div className="sf-icon"><AlertTriangle size={13} /></div>
                            <div>
                                <div className="sf-label">Help &amp; Support</div>
                                <div className="sf-sub">support@insta-group.com</div>
                            </div>
                            <ChevronRight size={13} className="sf-arrow" />
                        </a>
                    </div>
                </aside>

                {/* ═══════ MAIN CONTENT ═══════ */}
                <main className="main-content" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
                    <header className="main-header" style={{ flexShrink: 0 }}>
                        <div className="header-welcome" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <button className="icon-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
                                <Menu size={20} />
                            </button>
                            <div>
                                <h1>Execution Projects <strong>Board</strong></h1>
                                <p className="header-role">Drag and drop projects to update workflow stages</p>
                            </div>
                        </div>
                        
                        <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {/* Timeline Pill */}
                            <div className="animate-card" style={{ 
                                display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', 
                                background: 'var(--bg-in)', border: '1px solid var(--bd)', borderRadius: 'var(--r-md)'
                            }}>
                                <Calendar size={13} color="var(--tx3)" />
                                <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--tx3)' }}>Master Date</span>
                                <input 
                                    type="date" 
                                    value={dateRange.start}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                    style={{ background: 'transparent', border: 'none', font: 'inherit', fontSize: '11px', color: 'var(--tx)', outline: 'none', width: '105px' }}
                                />
                                <span style={{ color: 'var(--tx3)', fontSize: '11px' }}>→</span>
                                <input 
                                    type="date" 
                                    value={dateRange.end}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                    style={{ background: 'transparent', border: 'none', font: 'inherit', fontSize: '11px', color: 'var(--tx)', outline: 'none', width: '105px' }}
                                />
                            </div>

                            <motion.button 
                                whileTap={{ scale: 0.95 }}
                                className="icon-btn" 
                                onClick={loadData} 
                                disabled={loading}
                                title="Refresh Board"
                                style={{ 
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    fontSize: '13px', fontWeight: 600,
                                    padding: '6px 14px', height: '36px',
                                    background: 'var(--red)', color: 'white', 
                                    border: 'none', borderRadius: 'var(--r-md)',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none', flexShrink: 0 }} />
                                {loading ? 'Loading...' : 'Refresh'}
                            </motion.button>
                            
                            <div className="theme-switch" style={{ height: '38px' }}>
                                <span className={!isDark ? 'ts-label active' : 'ts-label'} style={{ fontSize: '11px' }}>Light</span>
                                <button className="ts-track" onClick={toggleTheme}><div className="ts-thumb" /></button>
                                <span className={isDark ? 'ts-label active' : 'ts-label'} style={{ fontSize: '11px' }}>Dark</span>
                            </div>
                            
                            <motion.button whileTap={{ scale: 0.95 }} className="icon-btn" onClick={logout} style={{ color: '#E53935' }}>
                                <LogOut size={16} />
                            </motion.button>
                        </div>
                    </header>
                    <div className="header-accent-bar" style={{ flexShrink: 0 }} />

                    {error && <motion.div initial={{opacity:0, y:-10}} animate={{opacity:1, y:0}} className="error-banner" style={{ margin: '10px 24px' }}>⚠️ {error}</motion.div>}

                    {/* Toolbar / Filters */}
                    <div style={{ padding: '16px 24px' }}>
                        <FiltersToolbar 
                            projects={projects}
                            filterPM={filterPM} setFilterPM={setFilterPM}
                            filterCity={filterCity} setFilterCity={setFilterCity}
                            filterClient={filterClient} setFilterClient={setFilterClient}
                            filterStatus={filterStatus} setFilterStatus={setFilterStatus}
                            dateRange={dateRange} setDateRange={setDateRange}
                            searchQuery={searchQuery} setSearchQuery={setSearchQuery}
                            boardStages={BOARD_STAGES}
                        />
                    </div>

                    {/* Kanban Scrollable Canvas */}
                    <div className="board-canvas" style={{
                        flex: 1, padding: '0 24px 24px', overflowX: 'auto', overflowY: 'hidden',
                        display: 'flex', gap: '20px'
                    }}>
                        {loading && projects.length === 0 ? (
                            <BoardSkeleton stages={BOARD_STAGES} />
                        ) : (
                            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
                                {BOARD_STAGES.map(stage => (
                                    <KanbanColumn 
                                        key={stage}
                                        stage={stage}
                                        projects={confirmedProjects.filter(p => (p.board_stage || 'TBC') === stage)}
                                        onProjectClick={setSelectedProject}
                                    />
                                ))}
                            </DndContext>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
