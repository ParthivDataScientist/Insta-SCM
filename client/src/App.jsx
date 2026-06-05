import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './views/Login';
import ForgotPassword from './views/ForgotPassword';
import ResetPassword from './views/ResetPassword';
import DesignDashboard from './views/DesignDashboard';
import StoragePremium from './views/StoragePremium';
import ProjectsDashboardPremium from './views/ProjectsDashboardPremium';
import ProjectBoardPremium from './views/ProjectBoardPremium';
import ManagerTimelinePremium from './views/ManagerTimelinePremium';
import ShipmentDashboardPremium from './views/ShipmentDashboardPremium';
import ShipmentBookingPage from './views/ShipmentBookingPage';
import { GlobalDateRangeProvider } from './contexts/GlobalDateRangeContext';
import { ThemeProvider } from './contexts/ThemeContext';
import './styles.css';
import './premium-theme.css';
import './saas-theme.css';
import './design-dashboard.css';

// Initialize React Query Client
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5000,
            refetchOnWindowFocus: true,
            retry: 1,
        },
    },
});

const ProtectedRoute = ({ children }) => {
    return children;
};

const GordianProtectedRoute = ({ children }) => {
    return children;
};

const RootRedirect = () => {
    const activeTenant = localStorage.getItem('tenant_id') || 'gordian';
    if (activeTenant === 'insta') {
        return <Navigate to="/design" replace />;
    } else {
        return <Navigate to="/dashboard" replace />;
    }
};

const TenantRedirect = () => {
    const { tenant } = useParams();
    const target = tenant === 'insta' ? '/design' : '/dashboard';
    return <Navigate to={target} replace />;
};

export default function App() {
    useEffect(() => {
        const handlePathChange = () => {
            const hostname = window.location.hostname.toLowerCase();
            const pathname = window.location.pathname.toLowerCase();
            const search = window.location.search.toLowerCase();
            
            let tenant = 'gordian';
            if (hostname.includes('insta') || pathname.includes('insta') || search.includes('insta')) {
                tenant = 'insta';
            } else if (hostname.includes('localhost') || hostname === '127.0.0.1') {
                const stored = localStorage.getItem('tenant_id');
                if (stored) {
                    tenant = stored;
                }
            }
            
            localStorage.setItem('tenant_id', tenant);
            
            const isInsta = tenant === 'insta';
            document.title = isInsta 
                ? "Insta Exhibition SCM — Logistics" 
                : "Gordian SCM & Logistics";
                
            let link = document.querySelector("link[rel~='icon']");
            if (link) {
                link.type = isInsta ? "image/jpeg" : "image/svg+xml";
                link.href = isInsta ? "/logo.jpg" : "/gordian.svg";
            }
        };

        handlePathChange();
        window.addEventListener('popstate', handlePathChange);
        
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        history.pushState = function() {
            originalPushState.apply(this, arguments);
            handlePathChange();
        };
        
        history.replaceState = function() {
            originalReplaceState.apply(this, arguments);
            handlePathChange();
        };
        
        return () => {
            window.removeEventListener('popstate', handlePathChange);
            history.pushState = originalPushState;
            history.replaceState = originalReplaceState;
        };
    }, []);

    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <ThemeProvider>
                    <BrowserRouter>
                        <GlobalDateRangeProvider>
                            <Routes>
                                <Route path="/login" element={<Login />} />
                                <Route path="/:tenant/login" element={<Login />} />
                                <Route path="/:tenant" element={<TenantRedirect />} />
                                {/* <Route path="/forgot-password" element={<ForgotPassword />} /> */}
                                {/* <Route path="/reset-password" element={<ResetPassword />} /> */}
                                <Route path="/" element={<RootRedirect />} />
                                <Route path="/design" element={<GordianProtectedRoute><DesignDashboard /></GordianProtectedRoute>} />
                                <Route path="/storage" element={<ProtectedRoute><StoragePremium /></ProtectedRoute>} />
                                <Route path="/projects" element={<GordianProtectedRoute><ProjectsDashboardPremium /></GordianProtectedRoute>} />
                                <Route path="/stages" element={<GordianProtectedRoute><ProjectBoardPremium /></GordianProtectedRoute>} />
                                <Route path="/board" element={<GordianProtectedRoute><Navigate to="/stages" replace /></GordianProtectedRoute>} />
                                <Route path="/project-officer" element={<GordianProtectedRoute><ManagerTimelinePremium /></GordianProtectedRoute>} />
                                <Route path="/timeline" element={<GordianProtectedRoute><Navigate to="/project-officer" replace /></GordianProtectedRoute>} />
                                <Route path="/dashboard" element={<ProtectedRoute><ShipmentDashboardPremium /></ProtectedRoute>} />
                                <Route path="/shipments/new" element={<ProtectedRoute><ShipmentBookingPage /></ProtectedRoute>} />
                                <Route path="/*" element={<Navigate to="/login" replace />} />
                            </Routes>
                        </GlobalDateRangeProvider>
                    </BrowserRouter>
                </ThemeProvider>
            </AuthProvider>
        </QueryClientProvider>
    );
}
