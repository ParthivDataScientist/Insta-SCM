import React, { useMemo, useState } from 'react';
import { Archive, Briefcase, Layout, LogOut, Menu, Moon, PenTool, RefreshCw, Sun, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
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
    subtitle,
    headerCenter = null,
    actions = null,
    toolbar = null,
    showGlobalDate = true,
    children,
}) {
    const { logout } = useAuth();
    const { theme, isDark, toggleTheme } = useTheme();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const nav = useMemo(() => NAV_ITEMS, []);

    return (
        <div className={`${theme} premium-app`}>
            <div className={`premium-shell${sidebarOpen ? ' sidebar-open' : ''}`}>
                <aside className="premium-sidebar">
                    <div className="premium-sidebar__brand">
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

                <main className="premium-main">
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
                            {showGlobalDate ? <GlobalDateRangePicker compact /> : null}
                            {actions}
                            <button type="button" className="premium-icon-button" onClick={toggleTheme} title="Toggle theme">
                                {isDark ? <Sun size={16} /> : <Moon size={16} />}
                            </button>
                            <button type="button" className="premium-icon-button premium-icon-button--danger" onClick={logout} title="Logout">
                                <LogOut size={16} />
                            </button>
                        </div>
                    </header>

                    {toolbar ? <div className="premium-toolbar">{toolbar}</div> : null}

                    <section className="premium-page">
                        {children}
                    </section>
                </main>
            </div>
        </div>
    );
}
