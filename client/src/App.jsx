import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './views/Login';
import Register from './views/Register';
import ForgotPassword from './views/ForgotPassword';
import ResetPassword from './views/ResetPassword';
import DesignDashboard from './views/DesignDashboard';
import StoragePremium from './views/StoragePremium';
import ProjectsDashboardPremium from './views/ProjectsDashboardPremium';
import ProjectBoardPremium from './views/ProjectBoardPremium';
import ManagerTimelinePremium from './views/ManagerTimelinePremium';
import ShipmentDashboardPremium from './views/ShipmentDashboardPremium';
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
    const { user, loading } = useAuth();
    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
    if (!user) return <Navigate to="/login" />;
    return children;
};

export default function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <ThemeProvider>
                    <BrowserRouter>
                        <GlobalDateRangeProvider>
                            <Routes>
                                <Route path="/login" element={<Login />} />
                                <Route path="/register" element={<Register />} />
                                <Route path="/forgot-password" element={<ForgotPassword />} />
                                <Route path="/reset-password" element={<ResetPassword />} />
                                <Route path="/" element={<Navigate to="/design" replace />} />
                                <Route path="/design" element={<ProtectedRoute><DesignDashboard /></ProtectedRoute>} />
                                <Route path="/storage" element={<ProtectedRoute><StoragePremium /></ProtectedRoute>} />
                                <Route path="/projects" element={<ProtectedRoute><ProjectsDashboardPremium /></ProtectedRoute>} />
                                <Route path="/stages" element={<ProtectedRoute><ProjectBoardPremium /></ProtectedRoute>} />
                                <Route path="/board" element={<Navigate to="/stages" replace />} />
                                <Route path="/project-officer" element={<ProtectedRoute><ManagerTimelinePremium /></ProtectedRoute>} />
                                <Route path="/timeline" element={<Navigate to="/project-officer" replace />} />
                                <Route path="/dashboard" element={<ProtectedRoute><ShipmentDashboardPremium /></ProtectedRoute>} />
                                <Route path="/*" element={<Navigate to="/design" replace />} />
                            </Routes>
                        </GlobalDateRangeProvider>
                    </BrowserRouter>
                </ThemeProvider>
            </AuthProvider>
        </QueryClientProvider>
    );
}
