import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { AppCache } from '../utils/AppCache';
import { getBackendUrl } from '../utils/urlHelpers';
import { identifyUser, resetUser } from '../utils/analytics';

const AuthContext = createContext(null);

const BACKEND_URL = getBackendUrl();
const API_URL = `${BACKEND_URL}/api`;

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const AuthProvider = ({ children }) => {
  // Initialize user from localStorage cache for instant 0ms render (no spinner on refresh)
  const cachedUser = React.useMemo(() => {
    try {
      const stored = localStorage.getItem('mulu_user_cache');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  }, []);
  const cachedDriverProfile = React.useMemo(() => {
    try {
      const stored = localStorage.getItem('mulu_driver_cache');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  }, []);
  const [user, setUser] = useState(cachedUser);
  const [token, setToken] = useState(localStorage.getItem('token'));
  // loading = false immediately when we have a cached user — no spinner ever shown on refresh
  const [loading, setLoading] = useState(!cachedUser && !!localStorage.getItem('token'));
  const [driverProfile, setDriverProfile] = useState(cachedDriverProfile);

  const api = React.useMemo(() => {
    const instance = axios.create({
      baseURL: API_URL
    });

    instance.interceptors.request.use((config) => {
      const currentToken = localStorage.getItem('token');
      if (currentToken) {
        config.headers.Authorization = `Bearer ${currentToken}`;
      }
      return config;
    });

    return instance;
  }, []);

  const fetchUser = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await api.get('/auth/me');
      console.log('PROFILE_LOADED', response.data);
      setUser(response.data);
      if (response.data?.id) { identifyUser(response.data.id, { email: response.data.email, name: response.data.name, role: response.data.role }); }
      // Persist to localStorage so next refresh is instant (0ms)
      try { localStorage.setItem('mulu_user_cache', JSON.stringify(response.data)); } catch {}

      // Trigger background pre-download of key assets & data for zero-delay instant tab switching
      AppCache.preloadAll(api);

      // Fetch driver profile if user is a driver
      if (response.data.role === 'driver') {
        try {
          const driverRes = await api.get('/drivers/me');
          setDriverProfile(driverRes.data);
          try { localStorage.setItem('mulu_driver_cache', JSON.stringify(driverRes.data)); } catch {}
        } catch (e) {
          console.log('No driver profile found');
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      // ONLY log out if the backend explicitly rejects the token with 401/403
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        logout();
      } else {
        console.warn('Backend temporarily unreachable or waking up; preserving login session.');
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUser();

    // 1. Sync on window focus / app resume
    const handleFocus = () => {
      fetchUser();
    };

    // 2. Sync on tab / app visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchUser();
      }
    };

    // 3. Custom event for instant on-demand refresh across components
    const handleCustomRefresh = () => {
      fetchUser();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('mulu-refresh-user', handleCustomRefresh);

    // 4. Background heartbeat sync every 20s while authenticated
    const interval = setInterval(() => {
      if (localStorage.getItem('token') && document.visibilityState === 'visible') {
        fetchUser();
      }
    }, 20000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('mulu-refresh-user', handleCustomRefresh);
      clearInterval(interval);
    };
  }, [fetchUser]);

  const subscribeUserToPush = async (accessToken) => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      if (Notification.permission === 'denied') return;

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const vapidRes = await axios.get(`${API_URL}/notifications/vapid-public-key`);
        const vapidPublicKey = vapidRes.data.public_key;
        if (!vapidPublicKey) return;

        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });
      }

      await axios.post(`${API_URL}/notifications/subscribe`, subscription, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      console.log('Successfully configured push notifications');
    } catch (err) {
      console.error('Failed to subscribe to push notifications:', err);
    }
  };

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { access_token, user: userData } = response.data;

    localStorage.setItem('token', access_token);
    setToken(access_token);
    setUser(userData);
    console.log('LOGIN_SUCCESS', userData);
    if (userData?.id) { identifyUser(userData.id, { email: userData.email, name: userData.name, role: userData.role }); }

    if (userData.role === 'driver') {
      try {
        const driverRes = await axios.get(`${API_URL}/drivers/me`, {
          headers: { Authorization: `Bearer ${access_token}` }
        });
        setDriverProfile(driverRes.data);
      } catch (e) {
        console.log('No driver profile');
      }
    }

    // Attempt push subscription after successful login
    subscribeUserToPush(access_token);

    return userData;
  };

  const register = async (name, email, phone, password, role = 'student', year_of_study = null, program_type = null, avatar_url = null) => {
    const payload = {
      name,
      email,
      phone,
      password,
      role,
      ...(year_of_study ? { year_of_study: parseInt(year_of_study) } : {}),
      ...(program_type ? { program_type } : {}),
      ...(avatar_url ? { avatar_url } : {})
    };
    const response = await api.post('/auth/register', payload);

    const { access_token, user: userData } = response.data;

    localStorage.setItem('token', access_token);
    setToken(access_token);
    setUser(userData);

    // Attempt push subscription after successful registration
    subscribeUserToPush(access_token);

    return userData;
  };

  const registerDriver = async (vehicleData) => {
    try {
      const response = await api.post('/drivers/register', vehicleData);
      setDriverProfile(response.data);

      // Refresh user to get updated role immediately
      await fetchUser();

      return response.data;
    } catch (error) {
      console.error('Driver registration error:', error);
      throw error;
    }
  };

  const signupDriver = async (userData, vehicleData) => {
    try {
      // 1. Register User
      const authResponse = await api.post('/auth/register', {
        ...userData,
        role: 'student' // Initial role
      });

      const { access_token, user: newUser } = authResponse.data;

      // 2. Set Token Immediately (Crucial for next request)
      localStorage.setItem('token', access_token);
      setToken(access_token);
      api.defaults.headers.Authorization = `Bearer ${access_token}`;

      // 3. Register Driver Profile
      const driverResponse = await api.post('/drivers/register', vehicleData, {
        headers: { Authorization: `Bearer ${access_token}` }
      });

      // 4. Update State
      setUser({ ...newUser, role: 'driver' });
      setDriverProfile(driverResponse.data);

      subscribeUserToPush(access_token);

      return newUser;
    } catch (error) {
      console.error('Driver signup error:', error);
      // Clean up if step 2 failed (prevent ghost users)
      logout();
      throw error;
    }
  };

  const logout = () => {
    resetUser();
    localStorage.removeItem('token');
    localStorage.removeItem('mulu_user_cache');
    localStorage.removeItem('mulu_driver_cache');
    setToken(null);
    setUser(null);
    setDriverProfile(null);
  };

  const refreshDriverProfile = async () => {
    if (user?.role === 'driver') {
      try {
        const response = await api.get('/drivers/me');
        setDriverProfile(response.data);
        return response.data;
      } catch (e) {
        console.error('Error refreshing driver profile:', e);
        if (e.response?.status === 404) {
          return null; // Profile truly doesn't exist
        }
        throw e; // Don't swallow network or 500 errors
      }
    }
    return null;
  };

  const updateUser = (updatedFields) => {
    setUser(prev => {
      const merged = { ...prev, ...updatedFields };
      try { localStorage.setItem('mulu_user_cache', JSON.stringify(merged)); } catch (e) {}
      return merged;
    });
  };

  const value = {
    user,
    setUser,
    updateUser,
    token,
    loading,
    driverProfile,
    setDriverProfile,
    api,
    fetchUser,
    login,
    register,
    registerDriver,
    signupDriver,
    logout,
    refreshDriverProfile,
    isAuthenticated: !!user,
    isDriver: user?.role === 'driver',
    isLecturer: user?.role === 'lecturer',
    isStudent: user?.role === 'student',
    isAdmin: user?.role === 'admin' || user?.role === 'super_admin',
    isSuperAdmin: user?.role === 'super_admin',
    isAccountant: user?.role === 'accountant'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
