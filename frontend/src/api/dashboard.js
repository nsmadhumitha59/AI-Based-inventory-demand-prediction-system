import apiClient from './client';

export const dashboardApi = {
  getDashboardData: async () => {
    const response = await apiClient.get('/dashboard/');
    return response.data;
  },
};
