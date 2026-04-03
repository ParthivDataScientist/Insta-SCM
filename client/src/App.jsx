import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './views/Login';
import Register from './views/Register';
import Storage from './views/Storage';
import DesignDashboard from './views/DesignDashboard';
import ProjectsDashboard from './views/ProjectsDashboard';
import ProjectBoard from './views/ProjectBoard';
import ManagerTimeline from './views/ManagerTimeline';
import ShipmentDashboard from './views/ShipmentDashboard';
import { GlobalDateRangeProvider } from './contexts/GlobalDateRangeContext';
import './styles.css';

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
                <BrowserRouter>
                    <GlobalDateRangeProvider>
                        <Routes>
                            <Route path="/login" element={<Login />} />
                            <Route path="/register" element={<Register />} />
                            <Route path="/" element={<Navigate to="/design" replace />} />
                            <Route path="/design" element={<ProtectedRoute><DesignDashboard /></ProtectedRoute>} />
                            <Route path="/storage" element={<ProtectedRoute><Storage /></ProtectedRoute>} />
                            <Route path="/projects" element={<ProtectedRoute><ProjectsDashboard /></ProtectedRoute>} />
                            <Route path="/board" element={<ProtectedRoute><ProjectBoard /></ProtectedRoute>} />
                            <Route path="/timeline" element={<ProtectedRoute><ManagerTimeline /></ProtectedRoute>} />
                            <Route path="/dashboard" element={<ProtectedRoute><ShipmentDashboard /></ProtectedRoute>} />
                            <Route path="/*" element={<Navigate to="/design" replace />} />
                        </Routes>
                    </GlobalDateRangeProvider>
                </BrowserRouter>
            </AuthProvider>
        </QueryClientProvider>
    );
}
