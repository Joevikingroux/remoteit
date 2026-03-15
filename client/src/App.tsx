import { Routes, Route, Navigate } from 'react-router-dom';
import SupportPage from './components/support/SupportPage';
import LoginPage from './components/dashboard/LoginPage';
import DashboardPage from './components/dashboard/DashboardPage';
import ActiveSessionsPage from './components/dashboard/ActiveSessionsPage';
import SessionHistoryPage from './components/dashboard/SessionHistoryPage';
import TeamPage from './components/dashboard/TeamPage';
import SettingsPage from './components/dashboard/SettingsPage';
import SessionViewer from './components/dashboard/SessionViewer';
import ProtectedRoute from './components/layout/ProtectedRoute';

export default function App() {
  return (
    <Routes>
      <Route path="/support" element={<SupportPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/sessions"
        element={
          <ProtectedRoute>
            <ActiveSessionsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/history"
        element={
          <ProtectedRoute>
            <SessionHistoryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/team"
        element={
          <ProtectedRoute>
            <TeamPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/session/:code"
        element={
          <ProtectedRoute>
            <SessionViewer />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/support" replace />} />
    </Routes>
  );
}
