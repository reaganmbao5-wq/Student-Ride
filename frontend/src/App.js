import React, { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LayoutGroup } from "framer-motion";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { WebSocketProvider } from "./context/WebSocketContext";
import { Toaster } from "./components/ui/sonner";
import { ThemeProvider } from "./context/ThemeContext";
import PushNotificationManager from "./components/common/PushNotificationManager";
import SWUpdateManager from "./components/common/SWUpdateManager";
import NetworkMonitor from "./components/common/NetworkMonitor";
import { StudentDashboardSkeleton, DriverDashboardSkeleton, AdminDashboardSkeleton, ProfilePageSkeleton } from "./components/common/PageSkeletons";

// Pages
import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import StudentDashboard from "./pages/StudentDashboard";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import CompleteProfilePage from "./pages/CompleteProfilePage";
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
import AdminPricingPage from "./pages/AdminPricingPage";
import ChatPage from "./pages/ChatPage";
import ProfilePage from "./pages/ProfilePage";

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    // Show role-appropriate skeleton while auth validates in background
    const role = user?.role || '';
    if (role === 'driver') return <DriverDashboardSkeleton />;
    if (role === 'admin' || role === 'super_admin') return <AdminDashboardSkeleton />;
    // Default: student skeleton (covers brand new sessions too)
    return <StudentDashboardSkeleton />;
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
    return <StudentDashboardSkeleton />;
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
      <LayoutGroup id="student-ride-flow">
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
        <Route
          path="/forgot-password"
          element={
            <ForgotPasswordPage />
          }
        />
        <Route
          path="/reset-password"
          element={
            <ResetPasswordPage />
          }
        />
        <Route
          path="/complete-profile"
          element={<CompleteProfilePage />}
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
            <ProtectedRoute allowedRoles={['student', 'driver']}>
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
        <Route
          path="/admin/pricing"
          element={
            <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
              <AdminPricingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/pricing"
          element={
            <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
              <AdminPricingPage />
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
    </LayoutGroup>
  </WebSocketProvider>
  );
};

// Ensure backend stays awake on free tiers
const KeepAlive = () => {
  useEffect(() => {
    // Ping every 10 minutes (600,000 ms)
    const interval = setInterval(() => {
      fetch(`${process.env.REACT_APP_API_URL || 'https://student-ride-backend.onrender.com'}/api/health`)
        .catch(() => { }); // ignore errors, just a keep-awake ping
    }, 600000);
    return () => clearInterval(interval);
  }, []);
  return null;
};

import { ErrorBoundary } from "./ErrorBoundary";

function App() {
  return (
    <ErrorBoundary>
      <div className="App">
        <BrowserRouter>
          <ThemeProvider>
            <AuthProvider>
            <AppRoutes />
            {/* Global Components */}
            <PushNotificationManager />
            <NetworkMonitor />
            <SWUpdateManager />
            <KeepAlive />
            <Toaster position="top-center" />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </div>
    </ErrorBoundary>
  );
}

export default App;
