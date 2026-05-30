import React, { useMemo, useState } from 'react';
import { Archive, Briefcase, Layout, LogOut, Menu, Moon, PenTool, RefreshCw, Sun, Truck, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import GlobalDateRangePicker from '../GlobalDateRangePicker';

const NAV_ITEMS = [
    { to: '/design', label: 'Design', icon: PenTool, key: 'design' },
    { to: '/projects', label: 'Projects', icon: Briefcase, key: 'projects' },
    { to: '/stages', label: 'Stages', icon: Layout, key: 'stages' },
    { to: '/project-officer', label: 'Project Officer', icon: RefreshCw, key: 'projectOfficer' },
    { to: '/dashboard', label: 'Shipments', icon: Truck, key: 'dashboard' },
    { to: '/storage', label: 'Storage', icon: Archive, key: 'storage' },
];

export default function AppShell({
    activeNav,
    title,
    subtitle,
    headerCenter = null,
    headerFilters = null,
    actions = null,
    header = null,
    toolbar = null,
    showGlobalDate = true,
    pageClassName = '',
    mainClassName = '',
    sidebarOverlay = false,
    children,
}) {
    const { logout } = useAuth();
    const { theme, isDark, toggleTheme } = useTheme();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const nav = useMemo(() => NAV_ITEMS, []);
    const headerOverrideProps = useMemo(
        () => ({
            theme,
            isDark,
            toggleTheme,
            logout,
            sidebarOverlay,
            sidebarOpen,
            toggleSidebar: () => setSidebarOpen((open) => !open),
        }),
        [isDark, logout, sidebarOpen, sidebarOverlay, theme, toggleTheme]
    );

    const shellClass = [
        'premium-shell',
        sidebarOverlay ? 'premium-shell--sidebar-overlay' : '',
        sidebarOpen ? 'sidebar-open' : '',
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div
            className={`${theme} premium-app`}
            data-sidebar-state={sidebarOverlay ? (sidebarOpen ? 'open' : 'closed') : undefined}
        >
            {sidebarOverlay && sidebarOpen ? (
                <button
                    type="button"
                    className="premium-sidebar-backdrop"
                    aria-label="Close navigation"
                    onClick={() => setSidebarOpen(false)}
                />
            ) : null}
            <div className={shellClass}>
                <aside className="premium-sidebar" id="app-primary-sidebar">
                    <div className="premium-sidebar__brand">
                        <button
                            type="button"
                            className="premium-sidebar__close"
                            aria-label="Close sidebar"
                            onClick={() => setSidebarOpen(false)}
                        >
                            <X size={16} />
                        </button>
                        <img src="/logo.jpg" alt="Insta SCM" className="premium-sidebar__logo" />
                        <div>
                            <div className="premium-sidebar__title">Insta SCM</div>
                            <div className="premium-sidebar__subtitle">Design to delivery</div>
                        </div>
                    </div>

                    <nav className="premium-sidebar__nav">
                        {nav.map(({ to, label, icon: Icon, key }) => (
                            <Link key={key} to={to} className={`premium-nav-link${activeNav === key ? ' is-active' : ''}`}>
                                <Icon size={16} />
                                <span>{label}</span>
                            </Link>
                        ))}
                    </nav>
                </aside>

                <main className={`premium-main${mainClassName ? ` ${mainClassName}` : ''}`}>
                    {header ? (
                        typeof header === 'function' ? header(headerOverrideProps) : header
                    ) : (
                        <header className="premium-header">
                            <div className="premium-header__title">
                                <button type="button" className="premium-icon-button mobile-only" onClick={() => setSidebarOpen((open) => !open)}>
                                    <Menu size={18} />
                                </button>
                                <div>
                                    <h1>{title}</h1>
                                    {subtitle ? <p>{subtitle}</p> : null}
                                </div>
                            </div>

                            {headerCenter ? (
                                <div className="premium-header__center">
                                    {headerCenter}
                                </div>
                            ) : (
                                <div className="premium-header__center premium-header__center--empty" />
                            )}

                            <div className="premium-header__actions">
                                {headerFilters ? <div className="premium-header__filters">{headerFilters}</div> : null}
                                {showGlobalDate ? <GlobalDateRangePicker compact /> : null}
                                {actions}
                                <button type="button" className="premium-icon-button" onClick={toggleTheme} title="Toggle theme">
                                    {isDark ? <Sun size={16} /> : <Moon size={16} />}
                                </button>
                                {/* <button type="button" className="premium-icon-button premium-icon-button--danger" onClick={logout} title="Logout">
                                    <LogOut size={16} />
                                </button> */}
                            </div>
                        </header>
                    )}

                    {toolbar ? <div className="premium-toolbar">{toolbar}</div> : null}

                    <section className={`premium-page${pageClassName ? ` ${pageClassName}` : ''}`}>
                        {children}
                    </section>
                </main>
            </div>
        </div>
    );
}
