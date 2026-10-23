import apiClient, { setAuthToken } from './client';

// These helpers match the implemented backend. AppContext remains in demo mode
// until its complete read/write flow is switched to these asynchronous calls.
export const authAPI = {
  login: async (username, password) => {
    const response = await apiClient.post('/auth/login', { username, password });
    setAuthToken(response.data.token);
    return response;
  },
  logout: async () => {
    try { return await apiClient.post('/auth/logout'); }
    finally { setAuthToken(null); }
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
