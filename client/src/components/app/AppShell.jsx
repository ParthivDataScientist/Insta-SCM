import React, { useMemo, useState } from 'react';
import { Archive, Briefcase, ChevronLeft, ChevronRight, Layout, LogOut, Menu, PenTool, RefreshCw, Truck, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import GlobalDateRangePicker from '../GlobalDateRangePicker';

const NAV_ITEMS = [
    { to: '/design', label: 'Design', icon: PenTool, key: 'design' },
    { to: '/projects', label: 'Projects', icon: Briefcase, key: 'projects' },
    { to: '/board', label: 'Board', icon: Layout, key: 'board' },
    { to: '/timeline', label: 'Timeline', icon: RefreshCw, key: 'timeline' },
    { to: '/dashboard', label: 'Shipments', icon: Truck, key: 'dashboard' },
    { to: '/storage', label: 'Storage', icon: Archive, key: 'storage' },
];

export default function AppShell({
    activeNav,
    title,
    subtitle = null,
    headerCenter = null,
    actions = null,
    toolbar = null,
    showGlobalDate = true,
    showLogout = false,
    pageClassName = '',
    children,
}) {
    const { logout } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => (
        typeof window !== 'undefined' && window.localStorage.getItem('insta_sidebar_collapsed') === 'true'
    ));

    const nav = useMemo(() => NAV_ITEMS, []);
    const isMobileViewport = () => typeof window !== 'undefined' && window.innerWidth <= 980;

    const toggleSidebar = () => {
        if (isMobileViewport()) {
            setSidebarOpen((open) => !open);
            return;
        }

        setSidebarCollapsed((current) => {
            const next = !current;
            window.localStorage.setItem('insta_sidebar_collapsed', String(next));
            return next;
        });
    };

    return (
        <div className="premium-app">
            <div className={`premium-shell${sidebarOpen ? ' sidebar-open' : ''}${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
                <button
                    type="button"
                    className="premium-icon-button premium-shell__nav-toggle"
                    onClick={toggleSidebar}
                    title={sidebarCollapsed ? 'Show menu' : 'Hide menu'}
                    aria-label={sidebarCollapsed ? 'Show navigation menu' : 'Hide navigation menu'}
                >
                    {isMobileViewport() ? <Menu size={14} /> : (sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />)}
                </button>

                <button
                    type="button"
                    className={`premium-sidebar-overlay${sidebarOpen ? ' is-visible' : ''}`}
                    onClick={() => setSidebarOpen(false)}
                    aria-label="Close navigation"
                />

                <aside className="premium-sidebar">
                    <div className="premium-sidebar__brand">
                        <img src="/logo.jpg" alt="Insta SCM" className="premium-sidebar__logo" />
                        <div className="premium-sidebar__brand-copy">
                            <div className="premium-sidebar__title">Insta SCM</div>
                            <div className="premium-sidebar__subtitle">Operations workspace</div>
                        </div>
                        <button type="button" className="premium-icon-button premium-icon-button--ghost mobile-only" onClick={() => setSidebarOpen(false)}>
                            <X size={16} />
                        </button>
                    </div>

                    <nav className="premium-sidebar__nav">
                        {nav.map(({ to, label, icon: Icon, key }) => (
                            <Link
                                key={key}
                                to={to}
                                className={`premium-nav-link${activeNav === key ? ' is-active' : ''}`}
                                onClick={() => setSidebarOpen(false)}
                                title={label}
                            >
                                <Icon size={16} />
                                <span>{label}</span>
                            </Link>
                        ))}
                    </nav>
                </aside>

                <main className="premium-main">
                    <header className="premium-header">
                        <div className="premium-header__lead">
                            <div className="premium-header__title">
                                <div>
                                    <h1>{title}</h1>
                                    {subtitle ? <p>{subtitle}</p> : null}
                                </div>
                            </div>

                            {headerCenter ? (
                                <div className="premium-header__center">
                                    {headerCenter}
                                </div>
                            ) : null}
                        </div>

                        <div className="premium-header__actions">
                            {showGlobalDate ? <GlobalDateRangePicker compact /> : null}
                            {actions}
                            {/* showLogout ? (
                                <button type="button" className="premium-icon-button premium-icon-button--danger" onClick={logout} title="Logout">
                                    <LogOut size={16} />
                                </button>
                            ) : null */}
                        </div>
                    </header>

                    {toolbar ? <div className="premium-toolbar">{toolbar}</div> : null}

                    <section className={`premium-page${pageClassName ? ` ${pageClassName}` : ''}`}>
                        {children}
                    </section>
                </main>
            </div>
        </div>
    );
}
