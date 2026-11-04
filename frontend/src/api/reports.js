import apiClient, { API_BASE_URL } from './client';

export const reportsApi = {
  getInventoryReport: async (params = {}) => {
    const response = await apiClient.get('/reports/inventory/', { params });
    return response.data;
  },
  getSalesReport: async (params = {}) => {
    const response = await apiClient.get('/reports/sales/', { params });
    return response.data;
  },
  getLowStockReport: async (params = {}) => {
    const response = await apiClient.get('/reports/low-stock/', { params });
    return response.data;
  },
  getInventoryCsvUrl: () => `${API_BASE_URL}/reports/inventory/?format=csv`,
  getSalesCsvUrl: (start = '', end = '') => {
    let url = `${API_BASE_URL}/reports/sales/?format=csv`;
    if (start) url += `&start_date=${start}`;
    if (end) url += `&end_date=${end}`;
    return url;
  },
  getLowStockCsvUrl: () => `${API_BASE_URL}/reports/low-stock/?format=csv`,
};
