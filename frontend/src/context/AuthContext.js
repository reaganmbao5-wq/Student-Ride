import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [driverProfile, setDriverProfile] = useState(null);

  const api = axios.create({
    baseURL: API_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  // Update axios headers when token changes
  useEffect(() => {
    if (token) {
      api.defaults.headers.Authorization = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.Authorization;
    }
  }, [token, api]);

  const fetchUser = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
      
      // Fetch driver profile if user is a driver
      if (response.data.role === 'driver') {
        try {
          const driverRes = await api.get('/drivers/me');
          setDriverProfile(driverRes.data);
        } catch (e) {
          console.log('No driver profile found');
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      logout();
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { access_token, user: userData } = response.data;
    
    localStorage.setItem('token', access_token);
    setToken(access_token);
    setUser(userData);
    
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
    
    return userData;
  };

  const register = async (name, email, phone, password, role = 'student') => {
    const response = await api.post('/auth/register', {
      name,
      email,
      phone,
      password,
      role
    });
    
    const { access_token, user: userData } = response.data;
    
    localStorage.setItem('token', access_token);
    setToken(access_token);
    setUser(userData);
    
    return userData;
  };

  const registerDriver = async (vehicleData) => {
    const response = await api.post('/drivers/register', vehicleData);
    setDriverProfile(response.data);
    
    // Refresh user to get updated role
    await fetchUser();
    
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setDriverProfile(null);
  };

  const refreshDriverProfile = async () => {
    if (user?.role === 'driver') {
      try {
        const response = await api.get('/drivers/me');
        setDriverProfile(response.data);
      } catch (e) {
        console.error('Error refreshing driver profile:', e);
      }
    }
  };

  const value = {
    user,
    token,
    loading,
    driverProfile,
    api,
    login,
    register,
    registerDriver,
    logout,
    refreshDriverProfile,
    isAuthenticated: !!user,
    isDriver: user?.role === 'driver',
    isAdmin: user?.role === 'admin' || user?.role === 'super_admin',
    isSuperAdmin: user?.role === 'super_admin'
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
