import apiClient, { API_BASE_URL } from './client';

export const salesApi = {
  getSales: async (params = {}) => {
    const response = await apiClient.get('/sales/', { params });
    return response.data;
  },
  createSale: async (saleData) => {
    const response = await apiClient.post('/sales/', saleData);
    return response.data;
  },
  getAnalytics: async (params = {}) => {
    const response = await apiClient.get('/sales/analytics/', { params });
    return response.data;
  },
  getExportCsvUrl: () => `${API_BASE_URL}/sales/export-csv/`,
  importCsv: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post('/sales/import-csv/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};
