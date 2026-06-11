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
import HtmlPageViewer from './views/HtmlPageViewer';
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

const RootRedirect = () => {
    return <Navigate to="/design" replace />;
};

export default function App() {
    useEffect(() => {
        localStorage.setItem('tenant_id', 'insta');
        document.title = "Insta Exhibition SCM — Logistics";
            
        let link = document.querySelector("link[rel~='icon']");
        if (link) {
            link.type = "image/jpeg";
            link.href = "/logo.jpg";
        }
    }, []);

    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <ThemeProvider>
                    <BrowserRouter>
                        <GlobalDateRangeProvider>
                            <Routes>
                                <Route path="/login" element={<Login />} />
                                <Route path="/" element={<RootRedirect />} />
                                <Route path="/design" element={<ProtectedRoute><DesignDashboard /></ProtectedRoute>} />
                                <Route path="/storage" element={<ProtectedRoute><StoragePremium /></ProtectedRoute>} />
                                <Route path="/projects" element={<ProtectedRoute><ProjectsDashboardPremium /></ProtectedRoute>} />
                                <Route path="/stages" element={<ProtectedRoute><ProjectBoardPremium /></ProtectedRoute>} />
                                <Route path="/board" element={<ProtectedRoute><Navigate to="/stages" replace /></ProtectedRoute>} />
                                <Route path="/project-officer" element={<ProtectedRoute><ManagerTimelinePremium /></ProtectedRoute>} />
                                <Route path="/timeline" element={<ProtectedRoute><Navigate to="/project-officer" replace /></ProtectedRoute>} />
                                <Route path="/dashboard" element={<ProtectedRoute><ShipmentDashboardPremium /></ProtectedRoute>} />
                                <Route path="/shipments/new" element={<ProtectedRoute><ShipmentBookingPage /></ProtectedRoute>} />
                                <Route path="/manpower-request" element={<ProtectedRoute><HtmlPageViewer title="Manpower Request" src="/digital-manpower-request.html" navKey="manpowerRequest" /></ProtectedRoute>} />
                                <Route path="/domestic-orders" element={<ProtectedRoute><HtmlPageViewer title="Domestic Orders" src="/domestic-orders-manager.html" navKey="domesticOrders" /></ProtectedRoute>} />
                                <Route path="/truck-requisition" element={<ProtectedRoute><HtmlPageViewer title="Truck Requisition" src="/online-truck-requisition.html" navKey="truckRequisition" /></ProtectedRoute>} />
                                <Route path="/expense-sheet" element={<ProtectedRoute><HtmlPageViewer title="Expense & Allowance Sheet" src="/project-expense-sheet-and-allowance-sheet.html" navKey="expenseSheet" /></ProtectedRoute>} />
                                <Route path="/export-fabric-orders" element={<ProtectedRoute><HtmlPageViewer title="Export Fabric Orders" src="/real-time-export-fabric-order-list.html" navKey="exportFabricOrders" /></ProtectedRoute>} />
                                <Route path="/*" element={<Navigate to="/login" replace />} />
                            </Routes>
                        </GlobalDateRangeProvider>
                    </BrowserRouter>
                </ThemeProvider>
            </AuthProvider>
        </QueryClientProvider>
    );
}
