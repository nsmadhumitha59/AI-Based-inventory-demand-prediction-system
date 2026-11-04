import apiClient from './client';

export const forecastingApi = {
  generateForecast: async (productId, horizonDays = 30) => {
    const response = await apiClient.post('/forecast/generate/', {
      product_id: productId,
      horizon_days: horizonDays,
    });
    return response.data;
  },
  getProductForecast: async (productId) => {
    const response = await apiClient.get(`/forecast/product/${productId}/`);
    return response.data;
  },
  getForecastHistory: async (params = {}) => {
    const response = await apiClient.get('/forecast/history/', { params });
    return response.data;
  },
  getRecommendations: async (params = {}) => {
    const response = await apiClient.get('/recommendations/', { params });
    return response.data;
  },
  reviewRecommendation: async (id, status = 'REVIEWED') => {
    const response = await apiClient.post(`/recommendations/${id}/review/`, { status });
    return response.data;
  },
};
