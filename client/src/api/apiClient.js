import axios from 'axios';

const API_ROOT = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/$/, '')
    : "";

const apiClient = axios.create({
    baseURL: API_ROOT,
    timeout: 10000,
    withCredentials: true, // Crucial for HTTP-only cookies
});

// Request Interceptor: Add Auth Header if token exists in localStorage (legacy/hybrid support)
// and inject API Key if configured.
apiClient.interceptors.request.use((config) => {
    const key = import.meta.env.VITE_API_KEY;
    const token = localStorage.getItem('access_token');
    
    if (key) {
        config.headers['X-API-Key'] = key;
    }
    
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Response Interceptor: Handle global errors like 401 Unauthorized
apiClient.interceptors.response.use((response) => {
    return response;
}, (error) => {
    if (error.response && error.response.status === 401) {
        // Auto-logout: Clear local session and redirect
        localStorage.removeItem('access_token');
        if (window.location.pathname !== '/login') {
            window.location.href = '/login';
        }
    }
    return Promise.reject(error);
});

export default apiClient;
