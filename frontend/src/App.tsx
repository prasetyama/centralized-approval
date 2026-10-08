import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { AuthGuard } from './components/organisms/AuthGuard';
import { MainLayout } from './components/organisms/MainLayout';
import { DashboardPage } from './pages/DashboardPage';
import { InboxPage } from './pages/InboxPage';
import { HistoryPage } from './pages/HistoryPage';
import { ApprovalDetailPage } from './pages/ApprovalDetailPage';
import { AdminUserPage } from './pages/AdminUserPage';
import { AdminWorkflowPage } from './pages/AdminWorkflowPage';
import { WorkflowSimulatorPage } from './pages/WorkflowSimulatorPage';
import { BrandMasterPage } from './pages/BrandMasterPage';
import { AdminLogsPage } from './pages/AdminLogsPage';
import { CcEmailConfigPage } from './pages/CcEmailConfigPage';
import { AdminOrgStructurePage } from './pages/AdminOrgStructurePage';
import { PRNonTradeFormPage } from './pages/PRNonTradeFormPage';
import { PRNonTradeListPage } from './pages/PRNonTradeListPage';

const AppRoutes = () => {
    const { loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            </div>
        );
    }

    return (
        <Routes>
            <Route
                path="/"
                element={
                    <AuthGuard>
                        <MainLayout />
                    </AuthGuard>
                }
            >
                <Route index element={<DashboardPage />} />
                <Route path="approval" element={<InboxPage />} />
                <Route path="history" element={<HistoryPage />} />
                <Route path="pr-non-trade" element={<PRNonTradeListPage />} />
                <Route path="pr-non-trade/create" element={<PRNonTradeFormPage />} />
                <Route path="pr-non-trade/:id/edit" element={<PRNonTradeFormPage />} />
                <Route path="workflow/:id" element={<ApprovalDetailPage />} />
                <Route path="admin/users" element={<AdminUserPage />} />
                <Route path="admin/workflows" element={<AdminWorkflowPage />} />
                <Route path="admin/workflows/:id/edit" element={<AdminWorkflowPage />} />
                <Route path="admin/workflows/new" element={<AdminWorkflowPage />} />
                <Route path="admin/workflow/simulator" element={<WorkflowSimulatorPage />} />
                <Route path="admin/master-data" element={<BrandMasterPage />} />
                <Route path="admin/org-structure" element={<AdminOrgStructurePage />} />
                <Route path="admin/cc-email-config" element={<CcEmailConfigPage />} />
                <Route path="admin/system-logs" element={<AdminLogsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
        </Routes>
    );
};

function App() {
    return (
        <ToastProvider>
            <AuthProvider>
                <AppRoutes />
            </AuthProvider>
        </ToastProvider>
    );
}

export default App;
