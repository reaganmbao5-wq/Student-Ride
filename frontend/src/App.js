import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { WebSocketProvider } from "./context/WebSocketContext";
import { Toaster } from "./components/ui/sonner";

// Pages
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import StudentDashboard from "./pages/StudentDashboard";
import RideRequestPage from "./pages/RideRequestPage";
import RideHistoryPage from "./pages/RideHistoryPage";
import DriverDashboard from "./pages/DriverDashboard";
import DriverRegisterPage from "./pages/DriverRegisterPage";
import DriverEarningsPage from "./pages/DriverEarningsPage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminDriversPage from "./pages/AdminDriversPage";
import AdminRidesPage from "./pages/AdminRidesPage";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import AdminDestinationsPage from "./pages/AdminDestinationsPage";
import ChatPage from "./pages/ChatPage";
import ProfilePage from "./pages/ProfilePage";

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-gold border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    // Redirect to appropriate dashboard based on role
    if (user?.role === 'admin' || user?.role === 'super_admin') {
      return <Navigate to="/admin" replace />;
    } else if (user?.role === 'driver') {
      return <Navigate to="/driver" replace />;
    } else {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
};

// Public Route (redirects if authenticated)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B0B] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-gold border-t-transparent animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    // Redirect to appropriate dashboard
    if (user?.role === 'admin' || user?.role === 'super_admin') {
      return <Navigate to="/admin" replace />;
    } else if (user?.role === 'driver') {
      return <Navigate to="/driver" replace />;
    } else {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
};

// App Routes Component (inside AuthProvider)
const AppRoutes = () => {
  const { isAuthenticated } = useAuth();

  return (
    <WebSocketProvider>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/auth"
          element={
            <PublicRoute>
              <AuthPage />
            </PublicRoute>
          }
        />

        {/* Student Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ride"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <RideRequestPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute allowedRoles={['student', 'driver']}>
              <RideHistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ride/chat/:rideId"
          element={
            <ProtectedRoute allowedRoles={['student', 'driver']}>
              <ChatPage />
            </ProtectedRoute>
          }
        />

        {/* Driver Routes */}
        <Route
          path="/driver"
          element={
            <ProtectedRoute allowedRoles={['driver']}>
              <DriverDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/driver/register"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <DriverRegisterPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/driver/earnings"
          element={
            <ProtectedRoute allowedRoles={['driver']}>
              <DriverEarningsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/driver/history"
          element={
            <ProtectedRoute allowedRoles={['driver']}>
              <RideHistoryPage />
            </ProtectedRoute>
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
              <AdminUsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/drivers"
          element={
            <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
              <AdminDriversPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/rides"
          element={
            <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
              <AdminRidesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
              <AdminSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/destinations"
          element={
            <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
              <AdminDestinationsPage />
            </ProtectedRoute>
          }
        />

        {/* Profile Route */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        {/* Catch all - redirect to landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </WebSocketProvider>
  );
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: 'rgba(18, 18, 18, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#fff',
                backdropFilter: 'blur(10px)'
              }
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
