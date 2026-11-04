import apiClient, { API_BASE_URL } from './client';

export const inventoryApi = {
  getProducts: async (params = {}) => {
    const response = await apiClient.get('/products/', { params });
    return response.data;
  },
  getProductsLookup: async () => {
    const response = await apiClient.get('/products/lookup/');
    return response.data;
  },
  getProduct: async (id) => {
    const response = await apiClient.get(`/products/${id}/`);
    return response.data;
  },
  createProduct: async (productData) => {
    const response = await apiClient.post('/products/', productData);
    return response.data;
  },
  updateProduct: async (id, productData) => {
    const response = await apiClient.put(`/products/${id}/`, productData);
    return response.data;
  },
  deleteProduct: async (id) => {
    const response = await apiClient.delete(`/products/${id}/`);
    return response.data;
  },
  adjustStock: async (id, adjustmentData) => {
    const response = await apiClient.post(`/products/${id}/adjust-stock/`, adjustmentData);
    return response.data;
  },
  getStockMovements: async (id, params = {}) => {
    const response = await apiClient.get(`/products/${id}/movements/`, { params });
    return response.data;
  },
  getAllStockMovements: async (params = {}) => {
    const response = await apiClient.get('/stock-movements/', { params });
    return response.data;
  },
  getCategories: async () => {
    const response = await apiClient.get('/categories/');
    return response.data;
  },
  createCategory: async (categoryData) => {
    const response = await apiClient.post('/categories/', categoryData);
    return response.data;
  },
  importCsv: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post('/products/import-csv/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  getExportCsvUrl: () => `${API_BASE_URL}/products/export-csv/`,
};
