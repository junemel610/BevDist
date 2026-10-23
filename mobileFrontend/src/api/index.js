import apiClient, { setAuthToken } from './client.js';

// These helpers match the implemented backend. AppContext remains in demo mode
// until its complete read/write flow is switched to these asynchronous calls.
export const authAPI = {
  login: async (username, password) => {
    const response = await apiClient.post('/auth/login', { username, password });
    setAuthToken(response.data.token);
    return response;
  },
  logout: async () => {
    const response = await apiClient.post('/auth/logout');
    setAuthToken(null);
    return response;
  },
};

export const appDataAPI = {
  get: () => apiClient.get('/app-data'),
};

export const invoicesAPI = {
  create: data => apiClient.post('/invoices', data),
  update: (id, data) => apiClient.put(`/invoices/${id}`, data),
  deliver: id => apiClient.post(`/invoices/${id}/deliver`),
  cancel: (id, reason) => apiClient.post(`/invoices/${id}/cancel`, { reason }),
};

export const paymentsAPI = {
  create: (customerId, data) => apiClient.post(`/customers/${customerId}/payments`, data),
};

export const supplierOrdersAPI = {
  create: data => apiClient.post('/supplier-orders', data),
};

export const customersAPI = {
  create: data => apiClient.post('/customers', data),
  update: (id, data) => apiClient.put(`/customers/${id}`, data),
};

export const suppliersAPI = {
  create: data => apiClient.post('/suppliers', data),
  update: (id, data) => apiClient.put(`/suppliers/${id}`, data),
};

export const productsAPI = {
  create: data => apiClient.post('/products', data),
  update: (id, data) => apiClient.put(`/products/${id}`, data),
  remove: id => apiClient.delete(`/products/${id}`),
  adjustStock: (id, data) => apiClient.post(`/products/${id}/stock-adjustments`, data),
};
