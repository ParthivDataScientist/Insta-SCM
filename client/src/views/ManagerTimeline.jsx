import React, { useState, useMemo, Suspense, lazy } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Layout, Truck, MapPin, Search, RefreshCw, X, ChevronLeft, ChevronRight, Archive, PenTool } from 'lucide-react';
import { Link } from 'react-router-dom';

// Hooks & API
import { useAuth } from '../contexts/AuthContext';
import { useGlobalDateRange } from '../contexts/GlobalDateRangeContext';
import projectsService from '../api/projects';

// Components
import TimelineHeader from '../components/GanttTimeline/TimelineHeader';
import ManagerRow from '../components/GanttTimeline/ManagerRow';
import UnassignedTray from '../components/GanttTimeline/UnassignedTray';
import GlobalDateRangePicker from '../components/GlobalDateRangePicker';
import { BoardSkeleton } from '../components/SkeletonLoader';

const ProjectBoardModal = lazy(() => import('../components/ProjectBoardModal'));

/**
 * ManagerTimeline View
 * High-performance Gantt chart for manager workload management.
 */
export default function ManagerTimeline() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const { dateRange } = useGlobalDateRange();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState('Day'); // Day, Week, Month
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBranch, setFilterBranch] = useState('All');
  const [selectedProject, setSelectedProject] = useState(null);
  const [virtualManagers, setVirtualManagers] = useState([]); // Non-DB managers added by user
  const [showAddManager, setShowAddManager] = useState(false);
  const [newManagerName, setNewManagerName] = useState('');

  // Time Window Logic (Infinite scroll: ±6 Months)
  const [timeWindow, setTimeWindow] = useState(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 6, 0);
    return { start, end };
  });

  // Calculate Time Units in View
  const timeUnits = useMemo(() => {
    const units = [];
    const current = new Date(timeWindow.start);
    
    if (viewMode === 'Day') {
      while (current <= timeWindow.end) {
        units.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
    } else if (viewMode === 'Week') {
      // Create week-long blocks
      while (current <= timeWindow.end) {
        units.push(new Date(current));
        current.setDate(current.getDate() + 7);
      }
    } else {
      // Month blocks
      while (current <= timeWindow.end) {
        units.push(new Date(current));
        current.setMonth(current.getMonth() + 1);
      }
    }
    return units;
  }, [timeWindow, viewMode]);

  const getCellWidth = () => {
    if (viewMode === 'Day') return 45;
    if (viewMode === 'Week') return 180;
    if (viewMode === 'Month') return 550;
    return 45;
  };

  const cellWidth = getCellWidth();
  const getManagerAllocations = (m) => m.allocations || m.projects || [];

  const projectInDateRange = (project) => {
    if (!dateRange.start && !dateRange.end) return true;
    if (!project?.event_start_date) return false;

    const eventDate = new Date(project.event_start_date);
    if (dateRange.start && eventDate < new Date(dateRange.start)) return false;
    if (dateRange.end && eventDate > new Date(dateRange.end)) return false;
    return true;
  };

  // Fetch Grouped Data
  const { data: timelineData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['manager_timeline'],
    queryFn: projectsService.fetchTimeline,
    staleTime: 10000
  });

  const { data: projectsData = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsService.fetchProjects,
    staleTime: 10000,
  });

  useQuery({
    queryKey: ['managers_list'],
    queryFn: projectsService.fetchManagers,
  });

  const refreshTimelineCaches = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['manager_timeline'] }),
      queryClient.invalidateQueries({ queryKey: ['projects'] }),
      queryClient.invalidateQueries({ queryKey: ['projectStats'] }),
      queryClient.invalidateQueries({ queryKey: ['managerProjects'] }),
    ]);
    await refetch();
  };

  const handleAllocationCommit = async (id, data) => {
    const payload = {};

    if (Object.prototype.hasOwnProperty.call(data, 'manager_id')) {
      payload.manager_id = data.manager_id ?? null;
    }

    if (data.allocation_start_date) {
      payload.dispatch_date = data.allocation_start_date;
      payload.allocation_start_date = data.allocation_start_date;
    }

    if (data.allocation_end_date) {
      payload.dismantling_date = data.allocation_end_date;
      payload.allocation_end_date = data.allocation_end_date;
    }

    if (Object.keys(payload).length === 0) return;

    await projectsService.updateProject(id, payload);
    await refreshTimelineCaches();
  };


  // Filtering Logic
  const { filteredData, unassignedProjects } = useMemo(() => {
    if (!timelineData) return { filteredData: [], unassignedProjects: [] };
    
    // Unassigned mapping
    const getManagerName = (m) => typeof m.manager === 'string' ? m.manager : (m.manager?.full_name || m.manager?.name || 'Unknown');
    const getProjects = (m) => m.allocations || m.projects || [];

    const unassignedData = timelineData.find(m => getManagerName(m) === 'Unassigned');
    const unassigned = unassignedData
      ? getProjects(unassignedData).map(a => a.project || a).filter(projectInDateRange)
      : [];

    // Combine real data with virtual placeholders
    const combined = [...timelineData].filter(m => getManagerName(m) !== 'Unassigned');
    virtualManagers.forEach(v => {
      if (!combined.some(m => getManagerName(m) === v)) {
        combined.push({ manager: v, projects: [] });
      }
    });

    const filtered = combined.filter(m => {
      const mName = getManagerName(m);
      const nameMatch = mName.toLowerCase().includes(searchQuery.toLowerCase());
      const pmAllocations = getProjects(m).filter(a => projectInDateRange(a.project || a));
      
      const branchMatch = filterBranch === 'All' || pmAllocations.some(a => 
        (a.project || a).branch === filterBranch || (a.project || a).venue?.includes(filterBranch)
      );

      if (pmAllocations.length === 0) return nameMatch && (filterBranch === 'All' || virtualManagers.includes(mName));
      
      return nameMatch && branchMatch;
    }).map((managerData) => ({
      ...managerData,
      allocations: getProjects(managerData).filter((allocation) => projectInDateRange(allocation.project || allocation)),
    }));

    return { filteredData: filtered, unassignedProjects: unassigned };
  }, [timelineData, virtualManagers, searchQuery, filterBranch, dateRange.start, dateRange.end]);

  const modalProject = useMemo(() => {
    if (!selectedProject) return selectedProject;

    const fullProject = projectsData.find((project) => project.id === selectedProject.id);
    if (fullProject) return fullProject;

    if (!timelineData) return selectedProject;

    for (const managerData of timelineData) {
      for (const allocation of getManagerAllocations(managerData)) {
        const project = allocation.project || allocation;
        if (project.id === selectedProject.id) {
          return project;
        }
      }
    }

    return selectedProject;
  }, [projectsData, selectedProject, timelineData]);

  const uniqueBranches = useMemo(() => {
    if (!timelineData) return ['All'];
    const branches = new Set(['All']);
    timelineData.forEach(m => {
      getManagerAllocations(m).forEach(a => {
        const p = a.project || a;
        if (p.branch) branches.add(p.branch);
      });
    });
    return Array.from(branches).sort();
  }, [timelineData]);

  // Handle Navigation
  const goToMonth = (dir) => {
    setTimeWindow(prev => {
      const nextStart = new Date(prev.start);
      nextStart.setMonth(nextStart.getMonth() + dir);
      nextStart.setDate(1); // Ensure first day
      const nextEnd = new Date(nextStart.getFullYear(), nextStart.getMonth() + 1, 0);
      return { start: nextStart, end: nextEnd };
    });
  };

  const goToToday = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setTimeWindow({ start, end });
  };

  const isDark = localStorage.getItem('insta_theme') === 'dark';

  // Scrolling Ref
  const parentRef = React.useRef(null);

  // Auto-scroll to Current Date on Mount
  React.useEffect(() => {
    if (!isLoading && parentRef.current) {
        const now = new Date();
        const start = new Date(timeWindow.start);
        const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
        const diffDays = Math.max(0, (nowMidnight - startMidnight) / (1000 * 60 * 60 * 24));
        const pxPerDay = viewMode === 'Day' ? cellWidth : viewMode === 'Week' ? (cellWidth / 7) : (cellWidth / 30);
        const autoScrollPx = (diffDays * pxPerDay) - 400; // Centered back a bit
        
        requestAnimationFrame(() => {
            if (parentRef.current) {
               parentRef.current.scrollLeft = Math.max(0, autoScrollPx);
            }
        });
    }
  }, [isLoading, timeWindow.start, cellWidth, viewMode]);

  return (
    <div className={isDark ? 'dark' : 'light'} style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div className={`app-layout ${sidebarOpen ? '' : 'sidebar-closed'}`}>
        
        {/* Project Details Modal */}
        <Suspense fallback={null}>
          {selectedProject && (
            <ProjectBoardModal 
              project={modalProject} 
              onClose={() => setSelectedProject(null)} 
              updateProjectFull={async (id, data) => {
                await projectsService.updateProject(id, data);
                await refreshTimelineCaches();
              }}
            />
          )}
        </Suspense>

        {/* ═══════ SIDEBAR ═══════ */}
        <aside className="sidebar" style={{ zIndex: 9999 }}>
          <div className="sidebar-logo">
            <img src="/logo.jpg" alt="Insta-SCM Logo" style={{ width: '130px', height: 'auto' }} />
          </div>
          <div className="sidebar-nav">
            <Link to="/design" className="sidebar-item">
              <PenTool size={17} /> Design Management
            </Link>
            <Link to="/projects" className="sidebar-item">
              <Briefcase size={17} /> Projects List
            </Link>
            <Link to="/board" className="sidebar-item">
              <Layout size={17} /> Project Board
            </Link>
            <Link to="/timeline" className="sidebar-item active">
              <RefreshCw size={17} /> Resource Timeline
            </Link>
            <Link to="/dashboard" className="sidebar-item">
              <Truck size={17} /> Shipment Tracking
            </Link>
            <Link to="/storage" className="sidebar-item">
              <Archive size={17} /> Storage
            </Link>
          </div>
        </aside>

        {/* ═══════ MAIN CONTENT ═══════ */}
        <main className="main-content" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100vh' }}>
          <header className="main-header" style={{ flexShrink: 0 }}>
            <div className="header-welcome" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button className="icon-btn" onClick={() => setSidebarOpen(!sidebarOpen)}><Layout size={20} /></button>
              <div>
                <h1>Manager <strong>Availability Timeline</strong></h1>
                <p className="header-role">Resource planning and workload visualization</p>
              </div>
            </div>

            <div className="header-right">
              <GlobalDateRangePicker compact />
              <div className="animate-card" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 8px', background: 'var(--bg-in)', borderRadius: 'var(--r-md)', border: '1px solid var(--bd)' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="icon-btn" onClick={() => goToMonth(-1)} style={{ width: '28px', height: '28px' }}><ChevronLeft size={14} /></button>
                  <button className="icon-btn" onClick={() => goToMonth(1)} style={{ width: '28px', height: '28px' }}><ChevronRight size={14} /></button>
                </div>
              </div>
              
              <button className="icon-btn btn-animate" onClick={() => refetch()} style={{ gap: 8 }}>
                <RefreshCw size={14} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} />
                Refresh
              </button>
            </div>
          </header>
          <div className="header-accent-bar" />

          {/* Smart Insights */}
          <div style={{ padding: '16px 28px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--bd)' }}>
            <div style={{ padding: '12px', border: '1px solid var(--bd)', borderRadius: 'var(--r-md)', background: 'var(--bg-ralt)' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--tx3)', textTransform: 'uppercase', marginBottom: '4px' }}>Total Managers</div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--tx)' }}>{timelineData?.length || 0}</div>
            </div>
            <div style={{ padding: '12px', border: '1px solid var(--bd)', borderRadius: 'var(--r-md)', background: 'var(--bg-ralt)' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--tx3)', textTransform: 'uppercase', marginBottom: '4px' }}>Conflict Warnings</div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--red)' }}>
                {timelineData?.reduce((acc, m) => acc + (getManagerAllocations(m).filter(a => {
                   const p = a.project || a;
                   // Quick overlap check for stats
                   return getManagerAllocations(m).some(otherAlloc => {
                     const other = otherAlloc.project || otherAlloc;
                     return other.id !== p.id &&
                       new Date(p.dispatch_date) <= (other.dismantling_date ? new Date(other.dismantling_date) : new Date()) &&
                       (p.dismantling_date ? new Date(p.dismantling_date) : new Date()) >= new Date(other.dispatch_date);
                   });
                }).length || 0), 0)}
              </div>
            </div>
            <div style={{ padding: '12px', border: '1px solid var(--bd)', borderRadius: 'var(--r-md)', background: 'var(--bg-ralt)' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--tx3)', textTransform: 'uppercase', marginBottom: '4px' }}>Fully Booked Managers</div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--org)' }}>
                {timelineData?.filter(m => getManagerAllocations(m).length > 3).length || 0}
              </div>
            </div>
            <div style={{ padding: '12px', border: '1px solid var(--bd)', borderRadius: 'var(--r-md)', background: 'var(--bg-ralt)' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--tx3)', textTransform: 'uppercase', marginBottom: '4px' }}>Available Now</div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--green)' }}>
                {timelineData?.filter(m => !getManagerAllocations(m).some(a => {
                    const p = a.project || a;
                    const start = new Date(p.dispatch_date);
                    const end = p.dismantling_date ? new Date(p.dismantling_date) : new Date();
                    const now = new Date();
                    return now >= start && now <= end;
                })).length || 0}
              </div>
            </div>
          </div>

          {/* Filtering & Toolbar */}
          <div style={{ padding: '16px 28px', background: 'var(--bg-card)', borderBottom: '1px solid var(--bd)', display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div className="header-search-bar" style={{ maxWidth: '280px' }}>
              <Search size={14} className="search-icon" />
              <input 
                className="header-search-input" 
                placeholder="Search Manager..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={15} color="var(--tx3)" />
              <select 
                value={filterBranch}
                onChange={e => setFilterBranch(e.target.value)}
                style={{ background: 'transparent', border: 'none', font: 'inherit', fontSize: '13px', color: 'var(--tx)', fontWeight: 600, outline: 'none' }}
              >
                {uniqueBranches.map(b => <option key={b} value={b}>{b === 'All' ? 'All Branches' : b}</option>)}
              </select>
            </div>

            <div className="theme-switch" style={{ marginLeft: 'auto' }}>
              <button 
                onClick={() => setShowAddManager(true)}
                className="btn-animate" 
                style={{ background: 'var(--green)', color: 'white', border: 'none', padding: '6px 14px', borderRadius: 'var(--r-md)', fontSize: '11px', fontWeight: 800, marginRight: '16px' }}
              >
                + ADD MANAGER
              </button>
              {['Day', 'Week', 'Month'].map(m => (
                <button key={m} onClick={() => setViewMode(m)} className={viewMode === m ? 'ts-label active' : 'ts-label'} style={{ padding: '4px 12px', borderRadius: '20px', background: viewMode === m ? 'var(--red)' : 'none', color: viewMode === m ? 'white' : 'inherit' }}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {showAddManager && (
            <div style={{ padding: '12px 28px', background: 'var(--bg-ralt)', borderBottom: '1px solid var(--bd)', display: 'flex', gap: '8px' }}>
               <input 
                autoFocus
                className="header-search-input" 
                placeholder="Enter manager name..." 
                value={newManagerName}
                onChange={e => setNewManagerName(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === 'Enter' && newManagerName.trim()) {
                    try {
                      await projectsService.createManager({ name: newManagerName.trim() });
                      setNewManagerName('');
                      setShowAddManager(false);
                      // Global invalidation for consistency
                      queryClient.invalidateQueries({ queryKey: ['manager_timeline'] });
                      queryClient.invalidateQueries({ queryKey: ['managers_list'] });
                      queryClient.invalidateQueries({ queryKey: ['projects'] });
                    } catch (err) {
                      console.error("Failed to create manager:", err);
                      alert("Error creating manager. Please check backend logs.");
                      setNewManagerName('');
                      setShowAddManager(false);
                    }
                  }
                }}
               />
               <button className="icon-btn" onClick={() => setShowAddManager(false)}><X size={14} /></button>
            </div>
          )}

          {/* Gantt Canvas */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div id="gantt-track-canvas" ref={parentRef} style={{ flex: 1, overflow: 'auto', background: 'var(--bg-ralt)', position: 'relative' }}>
              {isLoading ? (
                <div style={{ padding: '40px' }}><BoardSkeleton stages={['Loading...']} /></div>
              ) : (
                <div style={{ minWidth: '100%', width: (timeUnits.length * cellWidth) + 240, position: 'relative', minHeight: '100%' }}>
                  <TimelineHeader units={timeUnits} cellWidth={cellWidth} viewMode={viewMode} />
                  
                  {filteredData.map((managerData) => {
                    const mName = typeof managerData.manager === 'string' ? managerData.manager : (managerData.manager?.full_name || managerData.manager?.name || 'Unknown');
                    return (
                    <ManagerRow 
                      key={mName}
                      managerData={managerData} 
                      timelineStart={timeWindow.start} 
                      units={timeUnits} 
                      cellWidth={cellWidth}
                      viewMode={viewMode}
                      onProjectClick={setSelectedProject}
                      onAllocationCommit={handleAllocationCommit}
                      onRemoveManager={async (idOrName) => {
                        if (typeof idOrName === 'string' && virtualManagers.includes(idOrName)) {
                          setVirtualManagers(prev => prev.filter(v => v !== idOrName));
                          return;
                        }
                        const mName = typeof idOrName === 'number' ? (filteredData.find(m => m.manager?.id === idOrName)?.manager?.name || idOrName) : idOrName;
                        const confirmDelete = window.confirm(`Permanently delete manager: ${mName}?`);
                        if (!confirmDelete) return;

                        if (typeof idOrName === 'number') {
                           try {
                             await projectsService.deleteManager(idOrName);
                             queryClient.invalidateQueries({ queryKey: ['manager_timeline'] });
                             queryClient.invalidateQueries({ queryKey: ['managers_list'] });
                             queryClient.invalidateQueries({ queryKey: ['projects'] });
                           } catch (err) {
                             alert("Error deleting manager: " + (err.response?.data?.detail || err.message));
                           }
                        } else {
                           alert(`Cannot delete ${idOrName}: ID not found. Might be a ghost record or missing from database.`);
                        }
                      }}
                    />
                    );
                  })}

                   {/* Today indicator removed */}
                  {viewMode === 'Day' && timeUnits.some(d => d.toDateString() === new Date().toDateString()) && (
                    <div style={{
                      position: 'absolute', top: 0, bottom: '-2000px',
                      left: (() => {
                        const now = new Date();
                        const start = new Date(timeWindow.start);
                        const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                        const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
                        const diffDays = Math.ceil((nowMidnight - startMidnight) / (1000*60*60*24));
                        return 240 + (diffDays * cellWidth) + (cellWidth / 2);
                      })(),
                      width: '3px', background: 'var(--red)', zIndex: 99, pointerEvents: 'none',
                      boxShadow: 'none'
                    }}>
                      <div style={{ fontSize: '11px', fontWeight: 900, color: 'white', background: 'var(--red)', padding: '4px 8px', borderRadius: '4px', position: 'sticky', top: '24px', marginLeft: '-16px', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}></div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <UnassignedTray 
              projects={unassignedProjects} 
              onProjectClick={setSelectedProject} 
              onDropReassign={async (id, newPMId) => {
                await handleAllocationCommit(id, { manager_id: newPMId || null });
              }}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
