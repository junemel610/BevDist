import apiClient from './client';

// Auth endpoints
export const authAPI = {
  login: (username, password) =>
    apiClient.post('/auth/login', { username, password }),
  logout: () => apiClient.post('/auth/logout'),
};

// Products endpoints
export const productsAPI = {
  getAll: () => apiClient.get('/products'),
  getById: (id) => apiClient.get(`/products/${id}`),
  create: (data) => apiClient.post('/products', data),
  update: (id, data) => apiClient.put(`/products/${id}`, data),
};

// Orders endpoints
export const ordersAPI = {
  getAll: () => apiClient.get('/orders'),
  getById: (id) => apiClient.get(`/orders/${id}`),
  create: (data) => apiClient.post('/orders', data),
  updateStatus: (id, status) =>
    apiClient.patch(`/orders/${id}/status`, { status }),
};

// Customers endpoints
export const customersAPI = {
  getAll: () => apiClient.get('/customers'),
  getById: (id) => apiClient.get(`/customers/${id}`),
  create: (data) => apiClient.post('/customers', data),
};

// Inventory endpoints
export const inventoryAPI = {
  getAll: () => apiClient.get('/inventory'),
  getById: (id) => apiClient.get(`/inventory/${id}`),
  update: (id, data) => apiClient.put(`/inventory/${id}`, data),
};

// Balances endpoints
export const balancesAPI = {
  getAll: () => apiClient.get('/balances'),
  getByCustomer: (customerId) =>
    apiClient.get(`/balances/customer/${customerId}`),
  recordPayment: (id, data) =>
    apiClient.post(`/balances/${id}/payment`, data),
};

// Restocks endpoints
export const restocksAPI = {
  getAll: () => apiClient.get('/restocks'),
  create: (data) => apiClient.post('/restocks', data),
};
