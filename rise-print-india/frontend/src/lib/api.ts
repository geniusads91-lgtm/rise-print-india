import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  register: (data: any) => api.post('/auth/register', data),
  login: (data: any) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  refreshToken: (refreshToken: string) => api.post('/auth/refresh-token', { refreshToken }),
  sendOTP: (phone: string) => api.post('/auth/send-otp', { phone }),
  verifyOTP: (phone: string, otp: string) => api.post('/auth/verify-otp', { phone, otp }),
  getProfile: () => api.get('/auth/me'),
};

// Product APIs
export const productAPI = {
  getAll: (params?: any) => api.get('/products', { params }),
  getBySlug: (slug: string) => api.get(`/products/${slug}`),
  getCategories: () => api.get('/products/categories'),
};

// Order APIs
export const orderAPI = {
  getAll: (params?: any) => api.get('/orders', { params }),
  getById: (id: string) => api.get(`/orders/${id}`),
  create: (data: any) => api.post('/orders', data),
  update: (id: string, data: any) => api.put(`/orders/${id}`, data),
  cancel: (id: string, reason: string) => api.post(`/orders/${id}/cancel`, { reason }),
};

// User APIs
export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data: any) => api.put('/users/profile', data),
  getAddresses: () => api.get('/users/addresses'),
  addAddress: (data: any) => api.post('/users/addresses', data),
  updateAddress: (id: string, data: any) => api.put(`/users/addresses/${id}`, data),
  deleteAddress: (id: string) => api.delete(`/users/addresses/${id}`),
  getWallet: () => api.get('/users/wallet'),
  getOrders: (params?: any) => api.get('/users/orders', { params }),
};

// Payment APIs
export const paymentAPI = {
  create: (data: any) => api.post('/payments', data),
  getById: (id: string) => api.get(`/payments/${id}`),
  verify: (data: any) => api.post('/payments/verify', data),
  uploadScreenshot: (formData: FormData) => 
    api.post('/payments/upload-screenshot', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// District APIs
export const districtAPI = {
  getAll: () => api.get('/districts'),
  getById: (id: string) => api.get(`/districts/${id}`),
  getDistributors: (id: string) => api.get(`/districts/${id}/distributors`),
};

// Banner APIs
export const bannerAPI = {
  getAll: (position?: string) => api.get('/banners', { params: { position } }),
};

// Blog APIs
export const blogAPI = {
  getAll: (params?: any) => api.get('/blogs', { params }),
  getBySlug: (slug: string) => api.get(`/blogs/${slug}`),
};

// Review APIs
export const reviewAPI = {
  create: (data: any) => api.post('/reviews', data),
  getByProduct: (productId: string) => api.get(`/reviews/product/${productId}`),
};

// Notification APIs
export const notificationAPI = {
  getAll: () => api.get('/notifications'),
  markAsRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
};

// Admin APIs
export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getAnalytics: (params?: any) => api.get('/admin/analytics', { params }),
  // Products
  createProduct: (data: any) => api.post('/admin/products', data),
  updateProduct: (id: string, data: any) => api.put(`/admin/products/${id}`, data),
  deleteProduct: (id: string) => api.delete(`/admin/products/${id}`),
  // Orders
  getAllOrders: (params?: any) => api.get('/admin/orders', { params }),
  updateOrderStatus: (id: string, status: string) => api.put(`/admin/orders/${id}/status`, { status }),
  // Users
  getAllUsers: (params?: any) => api.get('/admin/users', { params }),
  updateUserRole: (userId: string, role: string) => api.put(`/admin/users/${userId}/role`, { role }),
  // Distributors
  getAllDistributors: (params?: any) => api.get('/admin/distributors', { params }),
  approveDistributor: (id: string) => api.put(`/admin/distributors/${id}/approve`),
  // Districts
  getAllDistricts: () => api.get('/admin/districts'),
  assignManager: (districtId: string, userId: string) => api.post('/admin/districts/assign-manager', { districtId, userId }),
};

// AI APIs
export const aiAPI = {
  getRecommendations: (userId: string) => api.get(`/ai/recommendations?userId=${userId}`),
  chat: (message: string, context?: any) => api.post('/ai/chat', { message, context }),
  getInsights: () => api.get('/ai/insights'),
  generateContent: (type: string, prompt: string) => api.post('/ai/generate-content', { type, prompt }),
};

export default api;
