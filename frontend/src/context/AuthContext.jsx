import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/auth';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('stockwise_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('stockwise_access_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('stockwise_access_token');
      if (savedToken) {
        try {
          const userData = await authApi.getCurrentUser();
          setUser(userData);
          localStorage.setItem('stockwise_user', JSON.stringify(userData));
        } catch (err) {
          console.error('Session expired or invalid', err);
          logout(false);
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (username, password) => {
    try {
      const data = await authApi.login(username, password);
      localStorage.setItem('stockwise_access_token', data.access);
      localStorage.setItem('stockwise_refresh_token', data.refresh);
      localStorage.setItem('stockwise_user', JSON.stringify(data.user));
      setToken(data.access);
      setUser(data.user);
      toast.success(`Welcome back, ${data.user.username}!`);
      return true;
    } catch (err) {
      const errMsg = err.response?.data?.detail || 'Invalid username or password';
      toast.error(errMsg);
      throw err;
    }
  };

  const register = async (userData) => {
    try {
      await authApi.register(userData);
      toast.success('Registration successful! Please log in.');
      return true;
    } catch (err) {
      const errors = err.response?.data;
      if (typeof errors === 'object') {
        const firstKey = Object.keys(errors)[0];
        const val = Array.isArray(errors[firstKey]) ? errors[firstKey][0] : errors[firstKey];
        toast.error(`${firstKey}: ${val}`);
      } else {
        toast.error('Registration failed.');
      }
      throw err;
    }
  };

  const logout = (showToast = true) => {
    localStorage.removeItem('stockwise_access_token');
    localStorage.removeItem('stockwise_refresh_token');
    localStorage.removeItem('stockwise_user');
    setToken(null);
    setUser(null);
    if (showToast) {
      toast.success('Logged out successfully');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!token && !!user,
        login,
        register,
        logout,
        setUser,
      }}
    >
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
