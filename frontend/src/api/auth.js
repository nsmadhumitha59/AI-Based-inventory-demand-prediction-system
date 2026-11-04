import apiClient from './client';

export const authApi = {
  login: async (username, password) => {
    const response = await apiClient.post('/auth/login/', { username, password });
    return response.data;
  },
  register: async (userData) => {
    const response = await apiClient.post('/auth/register/', userData);
    return response.data;
  },
  getCurrentUser: async () => {
    const response = await apiClient.get('/auth/me/');
    return response.data;
  },
  updateProfile: async (profileData) => {
    const response = await apiClient.put('/auth/me/', profileData);
    return response.data;
  },
};
